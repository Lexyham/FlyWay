
function resizeCanvas(canvas) {
  const ratio = 16 / 9;
  let width = window.innerWidth;
  let height = width / ratio;

  if (height > window.innerHeight) {
    height = window.innerHeight;
    width = height * ratio;
  }

  canvas.width = width;
  canvas.height = height;
}

window.addEventListener("resize", () => {
  const canvas = document.querySelector("canvas");
  if (canvas) resizeCanvas(canvas);
});

window.addEventListener("load", () => {
  const canvas = document.querySelector("canvas");
  if (canvas) resizeCanvas(canvas);
});
