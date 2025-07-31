export function showInputDialog(message, defaultValue, onSubmit) {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.top = "0px";
  overlay.style.left = "0px";
  overlay.style.right = "0px";
  overlay.style.bottom = "0px";
  overlay.style.backgroundColor = "rgba(0,0,0,0.6)";
  overlay.style.zIndex = "9999";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";

  const dialog = document.createElement("div");
  dialog.style.background = "#222";
  dialog.style.padding = "20px";
  dialog.style.border = "1px solid #444";
  dialog.style.color = "#fff";
  dialog.style.minWidth = "250px";

  const text = document.createElement("p");
  text.textContent = message;

  const input = document.createElement("input");
  input.type = "text";
  input.value = defaultValue ?? "";
  input.style.marginTop = "10px";
  input.style.width = "100%";
  input.style.padding = "5px";
  input.style.border = "1px solid #555";
  input.style.backgroundColor = "#111";
  input.style.color = "#fff";

  const buttonRow = document.createElement("div");
  buttonRow.style.marginTop = "15px";
  buttonRow.style.textAlign = "right";

  const confirmBtn = document.createElement("button");
  confirmBtn.textContent = "OK";
  confirmBtn.onclick = () => {
    document.body.removeChild(overlay);
    onSubmit(input.value);
  };

  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  cancelBtn.style.marginLeft = "10px";
  cancelBtn.onclick = () => {
    document.body.removeChild(overlay);
    onSubmit(null);
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      confirmBtn.click();
    } else if (e.key === "Escape") {
      cancelBtn.click();
    }
  });

  dialog.appendChild(text);
  dialog.appendChild(input);
  buttonRow.appendChild(confirmBtn);
  buttonRow.appendChild(cancelBtn);
  dialog.appendChild(buttonRow);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  input.focus();
  input.select();
}
