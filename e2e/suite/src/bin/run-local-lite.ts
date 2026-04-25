import { createScenarioContext } from "../lib/context.js";
import { runLocalLiteScenario } from "../scenarios/local-lite.js";

const context = await createScenarioContext("local-lite");
const result = await runLocalLiteScenario(context);
console.log(JSON.stringify(result, null, 2));
