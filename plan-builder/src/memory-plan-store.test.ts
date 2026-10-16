import { runPlanStoreContract } from './plan-store.contract';
import { MemoryPlanStore } from './memory-plan-store';

runPlanStoreContract(() => new MemoryPlanStore());
