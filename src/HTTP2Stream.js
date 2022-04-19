import EventEmitter from 'events';
import logd from 'logd';

const log = logd.module('HTTP2Stream');



export default class HTTP2Stream extends EventEmitter {


    constructor(stream) {
        super();
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
            if (err.message.includes('NGHTTP2_ENHANCE_YOUR_CALM')) {
                log.debug(`NGHTTP2_ENHANCE_YOUR_CALM - need to slow down: ${err.message}`);
                // close the stream, tell the session creator to back off a bit
                this.emit('enhance_your_calm');
                this._handleDestroyedStream();
            } else {
                this._handleDestroyedStream(err);
            }
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
            this.emit('error', err);
        }

        this._end(err);
    }


    /**
     * clean up events in preparation for the session termination
     */
    _end(err) {
        setImmediate(() => {
            // make sure no events are handled anymore
            if (this._stream) this._stream.removeAllListeners();

            // tell the outside that the stream has ended
            this.emit('end', err);

            // remove all event handlers
            this.removeAllListeners();

            // remove all references
            this._stream = null;
            this._request = null;
        });
    }



    end(code) {
        this.getStream().close(code);
    }
}