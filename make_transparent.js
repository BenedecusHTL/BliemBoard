import { Jimp } from "jimp";

async function processIcon() {
  try {
    const image = await Jimp.read('app-icon.jpg');
    
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
      const r = this.bitmap.data[idx + 0];
      const g = this.bitmap.data[idx + 1];
      const b = this.bitmap.data[idx + 2];
      
      const dist = ((255 - r) + (255 - g) + (255 - b)) / 3.0;
      
      if (dist < 20) {
        this.bitmap.data[idx + 3] = 0; // fully transparent
      } else if (dist < 80) {
        this.bitmap.data[idx + 3] = Math.floor(((dist - 20) / 60.0) * 255);
      }
    });
    
    await image.write('app-icon-transparent.png');
    console.log('Transparent PNG created successfully!');
  } catch (err) {
    console.error(err);
  }
}

processIcon();
