import { MemoryStore } from "./memory";
import { describeStoreContract } from "./store-contract";

describeStoreContract("MemoryStore", () => new MemoryStore());
