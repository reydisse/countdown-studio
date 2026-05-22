export * from './http.js';

// Opens the OS file picker via a hidden <input>. Returns a File[].
export function openFilePicker({ accept = '', multiple = false } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type     = 'file';
    input.accept   = accept;
    input.multiple = multiple;
    // Resolve with an empty array if the user cancels (no change fires).
    input.onchange = () => resolve(Array.from(input.files ?? []));
    input.click();
  });
}
