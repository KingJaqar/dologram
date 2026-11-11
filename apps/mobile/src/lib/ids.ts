/**
 * Client-generated UUIDs for mobile using expo-crypto (D-100).
 * Creates the DoloGram id generator bound to the native crypto implementation.
 */
import * as Crypto from 'expo-crypto';
import { createIdGenerator } from '@dologram/shared';

export const ids = createIdGenerator(() => Crypto.randomUUID());
