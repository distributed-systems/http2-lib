


export default class HTTP2Stream {


    constructor(stream) {
        this.setStream(stream);
    }

    getIp() {
        return this._stream.session.socket.remoteAddress;
    }

    isClosed() {
        return this._stream.closed || this._stream.destroyed || this._stream.aborted;
    }

    setStream(stream) {
        this._stream = stream;
        this._headers = new Map();

        this._stream.once('close', () => {
            this._handleDestroyedStream();
        });
        
        this._stream.once('error', (err) => {
            this._handleDestroyedStream(err);
        });
        
        this._stream.once('response', (headers) => {
            this.emit('response', headers);
        });
    }


    getStream() {
        return this._stream;
    }


    /**
    * get all data as a single buffer
    */
     async getBuffer() {
        if (this.isClosed()) {
            throw new Error(`Cannot get data from stream, stream has ended already`);
        }

        return new Promise((resolve, reject) => {
            let dataBuffer;

            this._stream.on('data', (chunk) => {
                if (!dataBuffer) dataBuffer = chunk;
                else dataBuffer += chunk;
            });

            this._stream.once('end', () => {
                resolve(dataBuffer);
            });

            this._stream.once('error', reject);
        });
    }

    
    /**
     * Handle sessions that are destroyed
     * 
     * @param {Error} err 
     */
     _handleDestroyedStream(err) {
        if (err) {
            log.error(`Stream error: ${err,message}`, err);
            this.emit('error', err);
        }

        this._end(err);
    }


    /**
     * clean uop events in preparation for the session termination
     */
    _end(err) {
        setImmediate(() => {
            // make sure no events are handled anymore
            this._stream.removeAllListeners();

            // tell the outside that the stream has ended
            this.emit('end', err);

            // remove all event handlers
            this.removeAllListeners();

            // remove all references
            this._stream = null;
            this._request = null;
        });
    }
}