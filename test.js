var fs = require('fs');
var MIDI = require('./MIDI.js');

var file = new MIDI.File(1, MIDI.TimeDivision.ticksPerBeat(8));

var headerTrack = new MIDI.Track();
var track = new MIDI.Track();

headerTrack.addEvent(new MIDI.SMTPEOffsetEvent(0, 0, 0, 0, 0));
headerTrack.addEvent(new MIDI.SetTempoEvent(500000));
headerTrack.addEvent(new MIDI.TimeSignatureEvent(4, 4, 2, 0x18, 8));
headerTrack.addEvent(new MIDI.EndOfTrackEvent());
for (var i = 12; i < 100; i++) {
    // deltaTime, eventType, channel, note, velocity
    track.addEvent(new MIDI.ChannelEvent(12, MIDI.ChannelEvent.NOTE_ON, 0, i, 0x7f));
    track.addEvent(new MIDI.ChannelEvent(4, MIDI.ChannelEvent.NOTE_OFF, 0, i, 0));
}
track.addEvent(new MIDI.EndOfTrackEvent());
file.addTrack(headerTrack);
file.addTrack(track);
fs.writeFileSync('output.mid', new Buffer(file.encode()));
