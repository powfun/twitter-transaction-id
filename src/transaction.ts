/**
 * Client Transaction ID Generator for X (formerly Twitter) API requests
 *
 * This module provides functionality to generate the x-client-transaction-id
 * header value required for authenticated API requests to X.
 */
import Cubic from "./cubic";
import { interpolate } from "./interpolate";
import { convertRotationToMatrix } from "./rotation";
import { floatToHex, isOdd } from "./utils";
import { Document } from "linkedom/types/interface/document";
import { Element } from "linkedom/types/interface/element";

export function decodeBase64(input: string): Uint8Array {
  return Buffer.from(input, 'base64');
}

/**
 * Encodes a byte array to a base64 string
 * @param input Byte array to encode
 * @returns Base64 encoded string
 */
export function encodeBase64(input: Uint8Array): string {
  return Buffer.from(input).toString('base64');
}

// Regular expression definitions for extracting necessary data from X's homepage
const ON_DEMAND_FILE_REGEX = /(['"])ondemand\.s\1:\s*(['"])([\w]*)\2/;
const INDICES_REGEX = /\(\w\[(\d{1,2})\],\s*16\)/g;

// Constants moved from class to module level
const ADDITIONAL_RANDOM_NUMBER = 3;
const DEFAULT_KEYWORD = "obfiowerehiring";

// Helper functions - these were previously private methods

/**
 * Extracts key byte indices from homepage document
 * @param homePageDocument Document to use
 * @returns Tuple of [rowIndex, keyByteIndices]
 */
async function getIndices(
  homePageDocument: Document
): Promise<[number, number[]]> {
  const keyByteIndices: string[] = [];
  const response = homePageDocument;

  // Extract content from response as string
  const responseStr = response.documentElement.outerHTML;

  const onDemandFileMatch = ON_DEMAND_FILE_REGEX.exec(responseStr);

  if (onDemandFileMatch) {
    const onDemandFileUrl = `https://abs.twimg.com/responsive-web/client-web/ondemand.s.${onDemandFileMatch[3]}a.js`;

    try {
      // Fetch ondemand file
      const onDemandFileResponse = await fetch(onDemandFileUrl);

      if (!onDemandFileResponse.ok) {
        throw new Error(
          `Failed to fetch ondemand file: ${onDemandFileResponse.statusText}`
        );
      }

      const responseText = await onDemandFileResponse.text();

      // Extract indices using regex
      let match: RegExpExecArray | null;
      INDICES_REGEX.lastIndex = 0; // Reset regex index
      while ((match = INDICES_REGEX.exec(responseText)) !== null) {
        keyByteIndices.push(match[1]);
      }
    } catch (error) {
      console.error("Error fetching ondemand file:", error);
    }
  }

  if (!keyByteIndices.length) {
    throw new Error("Couldn't get KEY_BYTE indices");
  }

  // Convert strings to numbers
  const numericIndices = keyByteIndices.map((index) => parseInt(index, 10));
  return [numericIndices[0], numericIndices.slice(1)];
}

/**
 * Extracts verification key from document
 * @param response Document to use
 * @returns X site verification key
 */
function getKey(response: Document): string {
  let content = "";

  // Extract key from meta tag
  const element = response.querySelector(
    "[name='twitter-site-verification']"
  );
  if (element) {
    content = element.getAttribute("content") ?? "";
  }

  if (!content) {
    throw new Error("Couldn't get key from the page source");
  }
  return content;
}

/**
 * Converts key string to byte array
 * @param key Base64 encoded key string
 * @returns Array of byte values
 */
function getKeyBytes(key: string): number[] {
  return Array.from(decodeBase64(key));
}

/**
 * Gets animation frames from document
 * @param response Document to use
 * @returns Array of frame elements
 */
function getFrames(response: Document): Element[] {
  return Array.from(response.querySelectorAll("[id^='loading-x-anim']"));
}

/**
 * Parses SVG paths to extract coordinate arrays
 * @param keyBytes Key bytes from site verification
 * @param response Document to use
 * @param frames Optional frame elements if already fetched
 * @returns 2D array of frame coordinates
 */
function get2dArray(
  keyBytes: number[],
  response: Document,
  frames?: Element[]
): number[][] {
  if (!frames) {
    frames = getFrames(response);
  }

  if (!frames || !frames.length) {
    return [[]]; // Return empty 2D array
  }

  // 1. Select frame and navigate DOM to get "d" attribute
  const frame = frames[keyBytes[5] % 4];
  const firstChild = frame.children[0] as Element;
  const targetChild = firstChild.children[1] as Element;
  const dAttr = targetChild.getAttribute("d");
  if (dAttr === null) {
    return [];
  }

  // 2. Remove first 9 chars and split by "C"
  const items = dAttr.substring(9).split("C");

  // 3. Extract and convert numbers from each segment
  return items.map((item: string) => {
    // a) Replace non-digits with spaces
    const cleaned = item.replace(/[^\d]+/g, " ").trim();
    // b) Split by whitespace
    const parts = cleaned === "" ? [] : cleaned.split(/\s+/);
    // c) Convert string to integers
    return parts.map((str: string) => parseInt(str, 10));
  });
}

/**
 * Calculates value within specified range
 * @param value Input value (0-255)
 * @param minVal Minimum output value
 * @param maxVal Maximum output value
 * @param rounding Whether to use floor (true) or round (false)
 * @returns Calculated value
 */
function solve(
  value: number,
  minVal: number,
  maxVal: number,
  rounding: boolean
): number {
  const result = (value * (maxVal - minVal)) / 255 + minVal;
  return rounding ? Math.floor(result) : Math.round(result * 100) / 100;
}

/**
 * Generates animation key from frame data
 * @param frames Array of frame values
 * @param targetTime Target time for animation
 * @returns Animation key string
 */
function animate(frames: number[], targetTime: number): string {
  const fromColor = frames.slice(0, 3).concat(1).map(Number);
  const toColor = frames.slice(3, 6).concat(1).map(Number);
  const fromRotation = [0.0];
  const toRotation = [solve(frames[6], 60.0, 360.0, true)];

  const remainingFrames = frames.slice(7);
  const curves = remainingFrames.map((item, counter) =>
    solve(item, isOdd(counter), 1.0, false)
  );

  const cubic = new Cubic(curves);
  const val = cubic.getValue(targetTime);
  const color = interpolate(fromColor, toColor, val).map((value) =>
    value > 0 ? value : 0
  );
  const rotation = interpolate(fromRotation, toRotation, val);
  const matrix = convertRotationToMatrix(rotation[0]);

  // Convert color and matrix values to hex string
  const strArr: string[] = color
    .slice(0, -1)
    .map((value) => Math.round(value).toString(16));

  for (const value of matrix) {
    let rounded = Math.round(value * 100) / 100;
    if (rounded < 0) {
      rounded = -rounded;
    }
    const hexValue = floatToHex(rounded);
    strArr.push(
      hexValue.startsWith(".")
        ? `0${hexValue}`.toLowerCase()
        : hexValue || "0"
    );
  }

  strArr.push("0", "0");
  const animationKey = strArr.join("").replace(/[.-]/g, "");
  return animationKey;
}

/**
 * Generates animation key used in transaction ID
 * @param keyBytes Key bytes from site verification
 * @param response Document to use
 * @param rowIndex Row index to use
 * @param keyByteIndices Key byte indices to use
 * @returns Animation key string
 */
function getAnimationKey(
  keyBytes: number[], 
  response: Document,
  rowIndex: number,
  keyByteIndices: number[]
): string {
  const totalTime = 4096;

  const rowIndexValue = keyBytes[rowIndex] % 16;

  // Generate frame time using key byte indices
  let frameTime = keyByteIndices.reduce((num1, num2) => {
    return num1 * (keyBytes[num2] % 16);
  }, 1);
  frameTime = Math.round(frameTime / 10) * 10;

  const arr = get2dArray(keyBytes, response);
  if (!arr || !arr[rowIndexValue]) {
    throw new Error("Invalid frame data");
  }

  const frameRow = arr[rowIndexValue];
  const targetTime = frameTime / totalTime;
  const animationKey = animate(frameRow, targetTime);

  return animationKey;
}

/**
 * Creates key and animationKey from homepage document
 * @param homePageDocument Document to extract data from
 * @returns Object with key and animationKey
 */
export async function create(homePageDocument: Document): Promise<{ key: string, animationKey: string }> {
  try {
    // Initialize indices
    const [rowIndex, keyByteIndices] = await getIndices(homePageDocument);

    // Get key from document
    const key = getKey(homePageDocument);
    if (!key) throw new Error("Failed to get key");

    // Convert key to byte array
    const keyBytes = getKeyBytes(key);

    // Generate animation key
    const animationKey = getAnimationKey(keyBytes, homePageDocument, rowIndex, keyByteIndices);

    return { key, animationKey };
  } catch (error) {
    console.error("Failed to initialize:", error);
    throw error;
  }
}

/**
 * Generates a transaction ID for X API requests
 * @param method HTTP method (GET, POST, etc.)
 * @param path API endpoint path
 * @param key Key from create function
 * @param animationKey Animation key from create function
 * @param timeNow Optional timestamp (defaults to current time)
 * @returns Base64 encoded transaction ID
 */
export async function generateTransactionId(
  method: string,
  path: string,
  key: string,
  animationKey: string,
  timeNow?: number
): Promise<string> {
  timeNow = timeNow || Math.floor((Date.now() - 1682924400 * 1000) / 1000);
  const timeNowBytes = [
    timeNow & 0xff,
    (timeNow >> 8) & 0xff,
    (timeNow >> 16) & 0xff,
    (timeNow >> 24) & 0xff,
  ];

  const keyBytes = getKeyBytes(key);

  // Generate hash data
  const data = `${method}!${path}!${timeNow}${DEFAULT_KEYWORD}${animationKey}`;

  // Calculate SHA-256 hash
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashBytes = Array.from(new Uint8Array(hashBuffer));

  const randomNum = Math.floor(Math.random() * 256);
  const bytesArr = [
    ...keyBytes,
    ...timeNowBytes,
    ...hashBytes.slice(0, 16),
    ADDITIONAL_RANDOM_NUMBER,
  ];

  const out = new Uint8Array([
    randomNum,
    ...bytesArr.map((item) => item ^ randomNum),
  ]);
  return encodeBase64(out).replace(/=/g, "");
}