function MIDI_generator() {
    function TimeDivision(b1, b2) {
        this.b1 = b1;
        this.b2 = b2;
    }

    TimeDivision.ticksPerBeat = function(tpb) {
        var b1 = (tpb >> 8) & 0x7f;
        var b2 = tpb & 0xff;
        return new TimeDivision(b1, b2);
    }

    /**
     * As of right now, using this seems to break the entire file.
     * A think GarageBand simply doesn't support SMTPE.
     */
    TimeDivision.framesPerSecond = function(fps, dropFrame) {
        if (fps % 24 == 0) {
            return new TimeDivision(0xe8, fps / 24);
        } else if (fps % 25 == 0) {
            return new TimeDivision(0xe7, fps / 25);
        } else if (fps % 30 == 0) {
            if (dropFrame) {
                return new TimeDivision(0xe3, fps / 30);
            } else {
                return new TimeDivision(0xe2, fps / 30);
            }
        }
        throw new Error('Invalid SMTPE unit length: ' + fps);
    }

    TimeDivision.prototype.encode = function() {
        return new Uint8Array([this.b1, this.b2]);
    }

    function Header(format, trackCount, division) {
        this.format = format;
        this.tracks = trackCount;
        this.division = division;
    }

    Header.prototype.encode = function() {
        var a = new Uint8Array([0x4d, 0x54, 0x68, 0x64, // MThd
            0x00, 0x00, 0x00, 0x06, // chunk size
            (this.format >> 8) & 0xff, this.format & 0xff,
            (this.tracks >> 8) & 0xff, this.tracks & 0xff,
            0, 0]);
        a.set(this.division.encode(), 12);
        return a;
    }
    
    function Track() {
        this.events = [];
    }
    
    Track.prototype.encode = function() {
        var encoded = [];
        var size = 8;
        for (var i = 0; i < this.events.length; i++) {
            var theEnc = this.events[i].encode();
            encoded.push(theEnc);
            size += theEnc.length;
        }
        var data = new Uint8Array(size);
        data.set([0x4d, 0x54, 0x72, 0x6b], 0);
        
        size -= 8;
        data.set([(size >> 24) & 0xff,
                  (size >> 16) & 0xff,
                  (size >> 8) & 0xff,
                  size & 0xff], 4);
        size = 8;
        for (var i = 0; i < encoded.length; i++) {
            data.set(encoded[i], size);
            size += encoded[i].length;
        }
        return data;
    }
    
    Track.prototype.addEvent = function(e) {
        this.events.push(e);
    }
    
    /**
     * A channel event is what it sounds like: an event from a keyboard
     * or other instrument.
     *
     * Create a NOTE_ON channel event:
     *  new ChannelEvent(delay, ChannelEvent.NOTE_ON, CHANNEL, NOTE, VELOCITY)
     * Create a NOTE_OFF channel event:
     *  new ChannelEvent(delay, ChannelEvent.NOTE_OFF, CHANNEL, NOTE, 0)
     */
    function ChannelEvent(deltaTime, eventType, channel, p1, p2) {
        var payload = [p1];
        if (typeof p2 == 'number') payload.push(p2);
        this.deltaTime = deltaTime;
        this.specifier = (eventType << 4) | channel;
        this.payload = new Uint8Array(payload);
    }
    
    ChannelEvent.encodeDeltaTime = function(dt) {
        if (dt >= (1 << 21)) {
            return new Uint8Array([((dt >> 21) & 0x7f) | 0x80,
                                   ((dt >> 14) & 0x7f) | 0x80,
                                   ((dt >> 7) & 0x7f) | 0x80,
                                   (dt & 0x7f)]);
        } else if (dt >= (1 << 14)) {
            return new Uint8Array([((dt >> 14) & 0x7f) | 0x80,
                                   ((dt >> 7) & 0x7f) | 0x80,
                                   (dt & 0x7f)]);
        } else if (dt >= (1 << 7)) {
            return new Uint8Array([((dt >> 7) & 0x7f) | 0x80,
                                   (dt & 0x7f)]);
        }
        return new Uint8Array([dt & 0x7f]);
    }
    
    ChannelEvent.prototype.encode = function() {
        var delta = ChannelEvent.encodeDeltaTime(this.deltaTime);
        var data = new Uint8Array(delta.length + this.payload.length + 1);
        data.set(delta, 0);
        data.set([this.specifier], delta.length);
        data.set(this.payload, delta.length + 1);
        return data;
    }
        
    ChannelEvent.NOTE_OFF = 0x8;
    ChannelEvent.NOTE_ON = 0x9;
    ChannelEvent.NOTE_AFTERTOUCH = 0xa;
    ChannelEvent.CONTROLLER = 0xb;
    ChannelEvent.PROGRAM_CHANGE = 0xc;
    ChannelEvent.CHANNEL_AFTERTOUCH = 0xd;
    ChannelEvent.PITCH_BEND = 0xe;
    
    /**
     * Octaves -1 through 9 (9 is half supported)
     */
    ChannelEvent.noteIndex = function(octave, letter) {
        var scale = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        return scale.indexOf(letter) + (scale.length * (octave + 1));
    }
    
    /**
     * Meta Events
     */
    
    function MetaEvent(type, data) {
        this.type = type;
        this.data = data;
    }
    
    MetaEvent.prototype.encode = function() {
        var len = this.data ? this.data.length : 0;
        var data = new Uint8Array(len + 4);
        data.set([0, 0xff, this.type, len], 0);
        if (this.data) data.set(this.data, 4);
        return data;
    }
    
    function EndOfTrackEvent() {
        MetaEvent.call(this, 0x2f);
    }
    
    EndOfTrackEvent.prototype = Object.create(MetaEvent.prototype);
    
    function SMTPEOffsetEvent(hour, mins, seconds, frames, frac) {
        MetaEvent.call(this, 0x54, new Uint8Array([hour, mins, seconds, frames, frac]));
    }
    
    SMTPEOffsetEvent.prototype = Object.create(MetaEvent.prototype);
    
    function SetTempoEvent(microsPerQuarter) {
        MetaEvent.call(this, 0x51, new Uint8Array([(microsPerQuarter >> 16) & 0xff,
                                             (microsPerQuarter >> 8) & 0xff,
                                             microsPerQuarter & 0xff]));
    }
    
    SetTempoEvent.prototype = Object.create(MetaEvent.prototype);
    
    function ChannelPrefixEvent(channel) {
        MetaEvent.call(this, 0x20, new Uint8Array([channel & 0xf]));
    }
    
    ChannelPrefixEvent.prototype = Object.create(MetaEvent.prototype);
    
    function SequenceNumberEvent(number) {
        MetaEvent.call(this, 0x0, new Uint8Array([(number >> 8) & 0xff,
                                            number & 0xff]));
    }
    
    SequenceNumberEvent.prototype = Object.create(MetaEvent.prototype);
    
    /**
     * nn = Numerator
     * dd = Denominator (expressed as 2^dd)
     * cc = MIDI clocks per metronome tick
     * bb = 1/32 notes per 24 midi clocks
     */
    function TimeSignatureEvent(nn, dd, cc, bb) {
        MetaEvent.call(this, 0x58, new Uint8Array([nn, dd, cc, bb]));
    }
    
    TimeSignatureEvent.prototype = Object.create(MetaEvent.prototype);
    
    /**
     * Raw file interface
     */
    
    function File(format, division) {
        this.tracks = [];
        this.format = format;
        this.division = division;
    }
    
    File.prototype.addTrack = function(t) {
        this.tracks.push(t);
    }
    
    File.prototype.encode = function() {
        var header = new Header(this.format, this.tracks.length, this.division);
        var encodes = [header.encode()];
        var bytes = encodes[0].length;
        for (var i = 0; i < this.tracks.length; i++) {
            var encoded = this.tracks[i].encode();
            encodes.push(encoded);
            bytes += encoded.length;
        }
        var result = new Uint8Array(bytes);
        bytes = 0;
        for (var i = 0; i < encodes.length; i++) {
            result.set(encodes[i], bytes);
            bytes += encodes[i].length;
        }
        return result;
    }
    
    /**
     * Basic file, used to represent easy-to-import MIDI
     * files.
     */
    function BasicFile(tpb) {
        File.call(this, 1, TimeDivision.ticksPerBeat(tpb));
        
        var header = new Track();
        header.addEvent(new MIDI.SMTPEOffsetEvent(0, 0, 0, 0, 0));
        header.addEvent(new MIDI.SetTempoEvent(500000));
        header.addEvent(new MIDI.TimeSignatureEvent(4, 4, 2, 0x18, 8));
        header.addEvent(new MIDI.EndOfTrackEvent());
        this.tracks.push(header);
    }
    
    BasicFile.prototype = Object.create(File.prototype);
    
    /**
     * A BasicTrack contains a series of notes.
     */
    function BasicTrack() {
        Track.call(this);
    }
    
    BasicTrack.prototype = Object.create(Track.prototype);
    
    /**
     * Example: track.addNote(3, 'C', 28, 4)
     */
    BasicTrack.prototype.addNote = function(octave, letter, delay, length, _channel) {
        var channel = _channel || 0;
        var note = ChannelEvent.noteIndex(octave, letter);
        this.addEvent(new ChannelEvent(delay, MIDI.ChannelEvent.NOTE_ON,
                                       channel, note, 0x7f));
        this.addEvent(new ChannelEvent(length, MIDI.ChannelEvent.NOTE_OFF,
                                       channel, note, 0));
    }
    
    BasicTrack.prototype.end = function() {
        this.addEvent(new EndOfTrackEvent());
    }
    
    return {
        TimeDivision: TimeDivision,
        Header: Header,
        Track: Track,
        ChannelEvent: ChannelEvent,
        MetaEvent: MetaEvent,
        EndOfTrackEvent: EndOfTrackEvent,
        SMTPEOffsetEvent: SMTPEOffsetEvent,
        SetTempoEvent: SetTempoEvent,
        ChannelPrefixEvent: ChannelPrefixEvent,
        SequenceNumberEvent: SequenceNumberEvent,
        TimeSignatureEvent: TimeSignatureEvent,
        File: File,
        BasicFile: BasicFile,
        BasicTrack: BasicTrack
    };
}

MIDI = MIDI_generator();
if (typeof module != 'undefined') module.exports = MIDI;
