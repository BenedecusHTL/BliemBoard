from PIL import Image

def process_icon():
    img = Image.open('app-icon.jpg').convert('RGBA')
    
    def get_alpha(p):
        # Calculate how close the pixel is to pure white
        # p is (R, G, B, A)
        dist = ((255 - p[0]) + (255 - p[1]) + (255 - p[2])) / 3.0
        
        # If it's very close to white, make it fully transparent
        if dist < 5:
            return 0
        # If it's somewhat close to white (the edge blending), create a smooth alpha transition
        elif dist < 60:
            return int((dist - 5) / 55.0 * 255)
        # Otherwise, keep it fully opaque
        return 255

    new_data = []
    for item in img.getdata():
        new_data.append((item[0], item[1], item[2], get_alpha(item)))

    img.putdata(new_data)
    img.save('app-icon.png', 'PNG')
    print("Transparent PNG created successfully!")

if __name__ == '__main__':
    process_icon()
