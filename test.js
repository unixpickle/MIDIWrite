var fs = require('fs');
var MIDI = require('./MIDI.js');

var file = new MIDI.BasicFile(8); // 8 units is 1 quarter note

// create a track
var track1 = new MIDI.BasicTrack();

// add a silly little tune
track1.addNote(3, 'C#', 0, 4);
track1.addNote(3, 'D#', 8, 4);
track1.addNote(3, 'D', 16, 4);
track1.addNote(3, 'E', 8, 4);
for (var i = 0; i < 2; i++) {
    track1.addNote(3, 'A', 16, 4);
    track1.addNote(3, 'G#', 8, 4);
    track1.addNote(3, 'G', 8, 4);
    track1.addNote(3, 'F#', 8, 4);
    track1.addNote(3, 'F', 8, 4);
}

// an example of adding raw MIDI events
for (var i = 12; i < 100; i++) {
    track1.addEvent(new MIDI.ChannelEvent(28, MIDI.ChannelEvent.NOTE_ON, 0, i, 0x7f));
    track1.addEvent(new MIDI.ChannelEvent(4, MIDI.ChannelEvent.NOTE_OFF, 0, i, 0));
}

// end the track and add it to our file
track1.end();
file.addTrack(track1);

fs.writeFileSync('output.mid', new Buffer(file.encode()));
