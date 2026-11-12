import { z } from "zod"

// List pages carry `limit` (integer 1..max) and `offset` (integer >= 0) so
// negative, fractional or oversized values never reach the API. Ordinary
// pages cap at 50; segment keys cap at 100.
export const limitField = (max: number, def: number, describe: string) =>
  z.number().int().min(1).max(max).optional().default(def).describe(describe)

export const offsetField = () =>
  z.number().int().min(0).optional().default(0).describe("Pagination offset")
