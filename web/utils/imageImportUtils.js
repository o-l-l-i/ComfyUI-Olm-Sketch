export function showImageUploadDialog(node, { maxSize = 2048 } = {}) {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.style.display = "none";

  document.body.appendChild(fileInput);

  fileInput.onchange = async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();

      reader.onload = () => {
        const img = new Image();
        img.onload = async () => {
          if (img.width > maxSize || img.height > maxSize) {
            alert(`Image is too large. Max allowed dimension is ${maxSize}px.`);
            return;
          }

          const formData = new FormData();
          formData.append("image", file);

          try {
            const res = await fetch("/upload/image", {
              method: "POST",
              body: formData,
            });

            const data = await res.json();
            const imagePath = `/view?filename=${data.name}&type=${
              data.type
            }&subfolder=${data.subfolder || ""}`;
            const imgLoaded = new Image();

            imgLoaded.onload = () => node.renderImage(imgLoaded);
            imgLoaded.onerror = () =>
              console.error("[OlmSketch] Failed to load image at", imagePath);
            imgLoaded.src = imagePath;
          } catch (err) {
            console.error("[OlmSketch] Upload failed:", err);
          }
        };

        img.onerror = () => alert("Failed to load the selected image.");

        if (typeof reader.result === "string") {
          img.src = reader.result;
        } else {
          alert("Failed to read the selected file.");
        }
      };

      reader.onerror = () => alert("Failed to read the selected file.");
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("[OlmSketch] Unexpected upload error:", err);
    }
  };

  fileInput.click();
}
