# Hardware visual references

These images are visual-development references for the procedural Three.js hardware components. They help establish a recognizable silhouette, material hierarchy, and exploded-view vocabulary; the application does not load them as runtime textures or 3D models.

| File | Purpose | Built-in ImageGen prompt summary |
| --- | --- | --- |
| `cpu-component-reference.png` | Reference for the CPU socket, substrate, heat spreader, exposed package, die, and schematic core regions. | A generic, unbranded server CPU shown as studio product views and an exploded technical cutaway, with realistic metal, substrate, contacts, and visible core tiles on a dark neutral background. |
| `gpu-component-reference.png` | Reference for the accelerator-card silhouette, PCB, PCIe edge, GPU package, surrounding memory packages, cooling shell, and exploded compute/memory relationship. | A generic, unbranded GPU accelerator shown as enclosed, bare-PCB, top, die-detail, and exploded technical views, with VRAM arranged around a purple compute die on a dark neutral background. |
| `dram-component-reference.png` | Reference for a recognizable DIMM silhouette, PCB, keyed gold edge, memory packages, SPD, conceptual package layers, and logical bank overlay. | A generic, unbranded server/desktop DIMM shown in orthographic, three-quarter, macro, exploded-package, and conceptual-bank views on a dark neutral background. |
| `ssd-component-reference.png` | Reference for an open NVMe SSD board, PCIe edge, controller, command/return buffers, two conceptual flash channels, four NAND packages, and stacked-die cutaway. | A generic, unbranded add-in NVMe SSD shown in orthographic, three-quarter, macro, profile, and exploded educational views on a dark neutral background. |

All four 1536 x 1024 PNGs were generated from text prompts with the built-in ImageGen tool on 2026-08-10. No specific CPU, GPU, DIMM, SSD, vendor, or commercial product is represented or endorsed. They are illustrative concept images, not photographs, technical drawings, benchmark evidence, or sources for real component counts, electrical topology, pin layouts, dimensions, or data paths. Generated labels and details may be invented or physically inconsistent.

The implementation therefore uses independently authored procedural Three.js geometry with named, controllable teaching components. CPU core/cache/LUT/exact/result regions, GPU PCIe/controller/VRAM/core/result regions, DRAM package/SPD/bank/payload regions, and SSD PCIe/controller/queue/channel/NAND/return regions are schematic visual anchors, not claims about a real product's floorplan or measured internal activity.

The requested external [`text-to-3d-asset` pipeline](https://github.com/LaurentiuGabriel/unreal-game-assets-creation-skill) was reviewed but not run locally. Its validated setup requires a Windows/NVIDIA workstation with Fooocus and Hunyuan3D services; Blender is used for its optional Unreal/FBX stage. This Darwin arm64 workspace had none of those services or Blender available. No generated GLB, FBX, or product-derived mesh is included here.
