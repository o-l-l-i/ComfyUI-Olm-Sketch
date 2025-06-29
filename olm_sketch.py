import torch
import numpy as np
from PIL import Image, ImageColor
import base64
import os
from server import PromptServer
from aiohttp import web
import folder_paths
import time
import traceback
import uuid
import re


COMFY_OUTPUT_BASE = os.path.abspath(os.path.join(os.getcwd(), "output"))

DEBUG_MODE = False


def debug_print(*args, **kwargs):
    if DEBUG_MODE:
        print(*args, **kwargs)


class OlmSketch:
    def __init__(self):
        self.device = "cpu"
        self.node_id = None
        self.drawing_uid = None

    @classmethod
    def INPUT_TYPES(cls):

        return {
            "required": {
                "drawing_version": ("STRING", {"default": "init"}),
                "drawing_filename": ("STRING", {"default": "unknown_drawing_filename"}),
                "drawing_uid": ("STRING", {"default": "__AUTO_GENERATE__"}),
                "workflow_name": ("STRING", {"default": "unknown_workflow"}),
                "save_directory": ("STRING", {"default": "my_drawings"}),
                "filename": ("STRING", {"default": "drawing.png"}),
                "width": ("INT", {"default": 512, "min": 64, "max": 2048}),
                "height": ("INT", {"default": 512, "min": 64, "max": 2048}),
                "color": ("STRING", {"default": "#ffffff"}),
                "background": ("STRING", {"default": "#000000"}),
            },
            "optional": {
            },
            "hidden": {
                "node_id": "UNIQUE_ID",
            }
        }

    RETURN_TYPES = ("IMAGE", "MASK")
    RETURN_NAMES = ("image", "mask")
    FUNCTION = "generate_drawing"
    CATEGORY = "image/drawing"


    def ensure_drawing_uid(self, drawing_uid, node_id):
        return ensure_drawing_uid_static(drawing_uid, node_id)


    def parse_color(self, color_str, fallback=(255, 255, 255, 255)):
        try:
            return ImageColor.getcolor(color_str, "RGBA")
        except Exception:
            print(f"⚠️ Invalid color string '{color_str}', using fallback.")
            return fallback


    def is_dark_color(self, rgba):
        r, g, b, _ = rgba
        luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
        return luminance < 128


    def generate_drawing(self, drawing_version, drawing_filename, drawing_uid, workflow_name, save_directory, filename, width, height, color, background, node_id=None, stroke_width=2):
        debug_print(f"=== OlmSketch.generate_drawing called ===")
        debug_print(f"drawing_version: '{drawing_version}'")
        debug_print(f"drawing_filename: '{drawing_filename}'")
        debug_print(f"drawing_uid: '{drawing_uid}'")
        debug_print(f"workflow_name: '{workflow_name}'")
        debug_print(f"save_directory: '{save_directory}'")
        debug_print(f"filename: '{filename}'")
        debug_print(f"Width: {width}, Height: {height}")
        debug_print(f"color: {color}")
        debug_print(f"background: {background}")
        debug_print(f"node_id: '{node_id}'")
        debug_print(f"stroke_width: {stroke_width}")

        self.node_id = node_id

        self.drawing_uid = self.ensure_drawing_uid(drawing_uid, node_id)

        bg_color = self.parse_color(background)
        debug_print(f"Creating base image with color: {bg_color}")
        image = Image.new("RGBA", (width, height), bg_color)

        temp_dir = folder_paths.get_temp_directory()
        drawing_path = os.path.join(temp_dir, drawing_filename)

        debug_print("temp_dir:", temp_dir)
        debug_print("drawing_path:", drawing_path)

        if (not os.path.exists(drawing_path)) and hasattr(self, 'node_id'):
            cache_dir = os.path.join(COMFY_OUTPUT_BASE, "olm_sketch_cache")
            safe_workflow_name = re.sub(r'[^a-zA-Z0-9_\-]', '_', workflow_name)
            cache_filename = f"drawing_{safe_workflow_name}_{self.drawing_uid}.png"
            cached_path = os.path.join(cache_dir, cache_filename)

            if os.path.exists(cached_path):
                debug_print(f"🧠 Auto-loading cached drawing: {cached_path}")
                drawing_path = cached_path
            else:
                debug_print(f"❌ No cached image found at: {cached_path}")

        if drawing_path and os.path.exists(drawing_path):
            try:
                debug_print(f"Loading saved drawing from: {drawing_path}")
                drawn_image = Image.open(drawing_path).convert("RGBA")

                if drawn_image.size != (width, height):
                    debug_print(f"Resizing drawing from {drawn_image.size} to ({width}, {height})")
                    drawn_image = drawn_image.resize((width, height), Image.Resampling.LANCZOS)

                image.paste(drawn_image, (0, 0), drawn_image)
                debug_print("✅ Drawing composited onto background.")
            except Exception as e:
                print(f"❌ Error loading drawing: {e}")
                traceback.print_exc()
        else:
            print("⚠️ No valid drawing file found. Using blank canvas.")

        debug_print("Converting image to tensor...")
        image_rgb = image.convert("RGB")
        image_np = np.array(image_rgb).astype(np.float32) / 255.0
        image_tensor = torch.from_numpy(image_np)[None,]
        debug_print(f"Image tensor shape: {image_tensor.shape}")

        is_dark = self.is_dark_color(bg_color)
        mask_image = image.convert("L")
        mask_np = np.array(mask_image).astype(np.float32) / 255.0
        mask_tensor = torch.from_numpy(mask_np if is_dark else 1.0 - mask_np)[None,]
        debug_print(f"Mask tensor shape: {mask_tensor.shape}")

        debug_print("=== OlmSketch.generate_drawing completed ===")
        return (image_tensor, mask_tensor)


def cleanup_old_drawings(directory, drawing_uid: str, max_age_secs=3600, max_files=50):
    now = time.time()
    prefix = f"drawing_{drawing_uid}_"

    try:
        files = sorted(
            [f for f in os.scandir(directory)
             if f.is_file() and f.name.startswith(prefix)],
            key=lambda f: f.stat().st_mtime
        )

        for f in files:
            age = now - f.stat().st_mtime
            if age > max_age_secs:
                os.remove(f.path)
                debug_print(f"🧹 Deleted expired temp file for node {drawing_uid}: {f.name}")

        files = sorted(
            [f for f in os.scandir(directory)
             if f.is_file() and f.name.startswith(prefix)],
            key=lambda f: f.stat().st_mtime
        )

        if len(files) > max_files:
            excess = len(files) - max_files
            for f in files[:excess]:
                os.remove(f.path)
                debug_print(f"🧹 Deleted excess temp file for node {drawing_uid}: {f.name}")

    except Exception as e:
        print(f"⚠️ Cleanup error for node {drawing_uid}: {e}")


def ensure_drawing_uid_static(drawing_uid, node_id):
    if drawing_uid and drawing_uid != "__AUTO_GENERATE__":
        debug_print(f"🟨 Ensure uid: Using existing drawing_uid: {drawing_uid}")
        return drawing_uid

    if node_id:
        new_uid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"comfyui_olm_sketch_{node_id}"))
    else:
        new_uid = str(uuid.uuid4())

    debug_print(f"🆕 Generated new drawing_uid: {new_uid}")
    return new_uid


@PromptServer.instance.routes.post("/api/drawing/save")
async def save_drawing(request):
    debug_print('=== API: save_drawing called ===')

    try:
        data = await request.json()

        node_id = data.get('id') or data.get('node_id') or ''
        drawing_uid = data.get('drawing_uid', '')
        image_data = data.get('image_data', '')
        workflow_name = data.get('workflow_name', 'unknown_workflow')
        drawing_filename = data.get('drawing_filename', 'uknown_drawing_filename')
        is_permanent = data.get('triggered_by_user_save', False)
        safe_workflow_name = re.sub(r'[^a-zA-Z0-9_\-]', '_', workflow_name)

        final_drawing_uid = ensure_drawing_uid_static(drawing_uid, node_id)
        debug_print(f"Using drawing_uid: {final_drawing_uid}")
        debug_print(f"node_id: {node_id}")
        debug_print(f"workflow_name: {workflow_name}")
        debug_print(f"safe_workflow_name: {safe_workflow_name}")
        debug_print(f"drawing_filename: {drawing_filename}")
        debug_print(f"is_permanent: {is_permanent}")

        if not image_data.startswith('data:image'):
            raise ValueError("Invalid image data")

        image_bytes = base64.b64decode(image_data.split(',')[1])

        temp_dir = folder_paths.get_temp_directory()
        os.makedirs(temp_dir, exist_ok=True)

        cleanup_old_drawings(temp_dir, drawing_uid=final_drawing_uid, max_age_secs=3600, max_files=50)

        timestamp = int(time.time() * 1000)
        temp_filename = f"drawing_{final_drawing_uid}_{timestamp}.png"
        temp_filepath = os.path.join(temp_dir, temp_filename)

        with open(temp_filepath, 'wb') as f:
            f.write(image_bytes)
        debug_print(f"🟨 Saved temp sketch to: {temp_filepath}")

        cache_filename = "unknown_cache_filename"
        if is_permanent:
            debug_print("attempt saving permanent graph-related file:")
            cache_dir = os.path.join(COMFY_OUTPUT_BASE, "olm_sketch_cache")
            os.makedirs(cache_dir, exist_ok=True)
            cache_filename = f"drawing_{safe_workflow_name}_{final_drawing_uid}.png"
            cache_path = os.path.join(cache_dir, cache_filename)
            debug_print("cache_dir: ", cache_dir)
            debug_print("cache_filename: ", cache_filename)
            debug_print("cache_path: ", cache_path)

            with open(cache_path, 'wb') as f:
                f.write(image_bytes)
            debug_print(f"✅ Auto-cached sketch to: {cache_path}")
        else:
            cache_filename = temp_filename

        debug_print(f"Looks like save was successful...")
        return web.json_response({
            "status": "success",
            "drawing_uid": final_drawing_uid,
            "workflow_name": workflow_name,
            "is_permanent": is_permanent,
            "temp_filename": temp_filename,
            "cache_filename": cache_filename
        })

    except Exception as e:
        print(f"❌ Error in save_drawing: {e}")
        traceback.print_exc()
        return web.json_response({
            "status": "error",
            "error": str(e)
        }, status=500)


@PromptServer.instance.routes.post("/api/drawing/save_permanent")
async def save_drawing_permanent(request):
    try:
        body = await request.json()
        image_data = body.get("image_data")
        filename = body.get("filename", "drawing_saved.png")
        user_dir = body.get("save_directory", "default_save_dir")

        if not image_data:
            raise ValueError("Missing 'image_data' in request")

        if not filename.endswith(".png"):
            filename += ".png"
        filename = os.path.basename(filename)

        user_dir = os.path.normpath(user_dir).replace("..", "").strip("/\\")
        target_dir = os.path.join(COMFY_OUTPUT_BASE, user_dir)

        os.makedirs(target_dir, exist_ok=True)

        if "," not in image_data:
            raise ValueError("Invalid image data format")
        base64_str = image_data.split(",", 1)[1]
        image_bytes = base64.b64decode(base64_str)

        save_path = os.path.join(target_dir, filename)
        with open(save_path, "wb") as f:
            f.write(image_bytes)

        debug_print(f"✅ Image saved to {save_path}")
        return web.json_response({
            "status": "success",
            "filename": filename,
            "path": save_path,
            "relative_path": os.path.relpath(save_path, COMFY_OUTPUT_BASE)
        })

    except Exception as e:
        print(f"❌ API Error (save_drawing_permanent): {str(e)}")
        traceback.print_exc()
        return web.json_response({"error": str(e)}, status=500)


@PromptServer.instance.routes.get("/api/drawing/load")
async def load_drawing(request):
    debug_print("=== /api/drawing/load ===")
    try:
        node_id = request.query.get("id")
        drawing_uid = request.query.get("drawing_uid", "")
        drawing_filename = request.query.get("drawing_filename")
        workflow_name = request.query.get("workflow_name", "unknown_workflow")
        safe_workflow_name = re.sub(r'[^a-zA-Z0-9_\-]', '_', workflow_name)


        if not drawing_uid:
            raise ValueError("Missing 'drawing_uid' in request")

        # testing uid system
        debug_print(f"id: {node_id}")
        debug_print(f"drawing_uid: {drawing_uid}")
        debug_print(f"drawing_filename: {drawing_filename}")
        debug_print(f"workflow_name: {workflow_name}")
        debug_print(f"safe_workflow_name: {safe_workflow_name}")

        temp_dir = folder_paths.get_temp_directory()
        debug_print(f"temp_dir: {temp_dir}")

        if drawing_filename:
            temp_filepath = os.path.join(temp_dir, drawing_filename)
            if os.path.exists(temp_filepath):
                debug_print(f"→ Loading from temp: {temp_filepath}")
                return web.FileResponse(temp_filepath)
            else:
                debug_print(f"→ Temp file does not exist, falling back to cache")

        cache_dir = os.path.join(COMFY_OUTPUT_BASE, "olm_sketch_cache")
        debug_print("cache_dir:", cache_dir)
        cached_drawing_filename = "drawing_" + workflow_name + "_" + drawing_uid + ".png"
        load_from_cache_path = os.path.join(cache_dir, cached_drawing_filename)
        debug_print("load_from_cache_path:", load_from_cache_path)

        if not load_from_cache_path:
            raise FileNotFoundError(f"No matching cache files found")

        debug_print(f"→ Loading from cache: {load_from_cache_path}")
        return web.FileResponse(load_from_cache_path)

    except FileNotFoundError as e:
        print(f"❌ File not found: {e}")
        return web.json_response({"error": str(e)}, status=404)
    except Exception as e:
        print(f"❌ Unexpected error in load_drawing: {e}")
        traceback.print_exc()
        return web.json_response({"error": str(e)}, status=500)



WEB_DIRECTORY = "./web"


NODE_CLASS_MAPPINGS = {
    "OlmSketch": OlmSketch
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "OlmSketch": "Olm Sketch"
}