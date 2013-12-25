# Purpose

The goal of this project is to make it super easy for newby developers to create MIDI files programmatically from JavaScript, either in a browser or on a server.

# Basic MIDI Writing

You can generate a basic MIDI file using this example:

    var file = new MIDI.BasicFile(8); // 8 units is 1 quarter note
    // create a track
    var track1 = new MIDI.BasicTrack();
    
    // add a silly little tune
    track1.addNote(3, 'C#', 0, 4);
    track1.addNote(3, 'D#', 8, 4);
    ...
    // end the track and add it to our file
    track1.end();
    file.addTrack(track1);
    
    // write file.encode() to a file or download it in the browser
    fs.writeFileSync('output.mid', new Buffer(file.encode()));
