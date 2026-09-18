
use rodio::{Decoder, OutputStream, Sink};
use std::fs::File;
use std::io::BufReader;

fn main() {
    let (_stream, stream_handle) = OutputStream::try_default().unwrap();
    let sink = Sink::try_new(&stream_handle).unwrap();
    
    let file = File::open("C:\\Users\\bened\\AppData\\Roaming\\com.bliemboard.app\\1788469376543szd6zfikkw.audio").unwrap();
    match Decoder::new(BufReader::new(file)) {
        Ok(decoder) => {
            println!("Decoding successful! Playing...");
            sink.append(decoder);
            sink.sleep_until_end();
            println!("Finished playing.");
        }
        Err(e) => println!("Error decoding: {:?}", e),
    }
}
