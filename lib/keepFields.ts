import { startTransition, type FormEvent } from "react";

/**
 * Submit handler for a useActionState form that keeps what the person typed.
 * React clears a form's fields after an `action={...}` submit, which wipes everything when the
 * server answers with an error (wrong password, missing stop name...). Submitting through
 * onSubmit instead keeps the fields.
 */
export function keepFields(dispatch: (form: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(() => dispatch(form));
  };
}
