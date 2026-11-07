import { sql, type SQL } from "drizzle-orm";
import { file } from "./schema";

/**
 * What a file is "attached to" – the one place that says which files belong to a machine, to a machine model and to
 * nothing (HS-36, ST-037, ST-117, ST-120). Each function is a condition on the outer `file` row; the readers add it to
 * their own `where`, so a file shows once however many of its attachments match, and none of them joins the attachments.
 *
 * - A **machine** has what is attached to it and what is attached to its machine model.
 * - A **machine model** has what is attached to it and what is attached to any of its machines, retired ones included.
 * - **Nowhere** is a file without any attachment.
 *
 * Removed files and retired machines play no part here: whether a reader leaves a removed file out is the reader's.
 */

/** The attachments table under the alias the conditions use. */
const attachment = sql.raw("file_attachment fa");
/** The machine model a machine is of – read from the machine, so no caller passes a model that may be out of date. */
const modelOf = (machineId: string) => sql`(select m.machine_model_id from machine m where m.id = ${machineId})`;

/** The files of a machine's record: attached to the machine or to its machine model. */
export function attachedToMachineOrItsModel(machineId: string): SQL {
  return sql`exists (
    select 1 from ${attachment}
    where fa.file_id = ${file.id}
      and (fa.machine_id = ${machineId} or fa.machine_model_id = ${modelOf(machineId)}))`;
}

/** Of the files of a machine's record, those every machine of the model shows: attached to the machine's model. */
export function attachedToItsModel(machineId: string): SQL {
  return sql`exists (
    select 1 from ${attachment}
    where fa.file_id = ${file.id} and fa.machine_model_id = ${modelOf(machineId)})`;
}

/** The files of a machine model: attached to it or to any of its machines, retired ones included. */
export function attachedToModelOrItsMachines(machineModelId: string): SQL {
  return sql`exists (
    select 1 from ${attachment}
    where fa.file_id = ${file.id}
      and (fa.machine_model_id = ${machineModelId}
        or fa.machine_id in (select m.id from machine m where m.machine_model_id = ${machineModelId})))`;
}

/** The files without any attachment. */
export function attachedToNothing(): SQL {
  return sql`not exists (select 1 from ${attachment} where fa.file_id = ${file.id})`;
}
