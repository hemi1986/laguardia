/** A form as the browser posts it – its fields, and a photo if one was chosen. For tests of a form's action. */
export function post(fields: Record<string, string>, photo?: File): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.append(name, value);
  if (photo) form.append("photo", photo);
  return form;
}
