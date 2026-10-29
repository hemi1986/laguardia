/**
 * The field the browser posts once per ticked maintenance task on the registration form (ST-097) – the runner reads them
 * all, as posted. A file of its own: the client form imports it, and the input function imports Collection.
 */
export const TASK_FIELD = "maintenanceTaskId";
