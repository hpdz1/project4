export { PROGRAMS, PROGRAMS_BY_ID, getProgram, programSenders, type Program } from "./programs";
export { getCoverage, type Coverage } from "./coverage";
export {
  EMAIL_PROVIDERS,
  buildFilterInstructions,
  collectSenders,
  guessEmailProvider,
  type EmailProvider,
  type FilterInstructions,
  type FilterOptions,
} from "./filters";
