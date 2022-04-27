import EventEmitter from 'events';
import logd from 'logd';

const log = logd.module('HTTP2Stream');



export default class HTTP2Stream extends EventEmitter {


    constructor(stream, identifier = 'n/a') {
        super();
        this.identifier = identifier;
        this._streamFailed = false;
        this.setStream(stream);
    }

    getIp() {
        return this._stream.session.socket.remoteAddress;
    }

    isClosed() {
        return !this._stream || this._stream.closed || this._stream.destroyed || this._stream.aborted;
    }

    getLogId() {
        return `[Client stream ${this.streamId}; this.identifier]: `;
    }

    setStream(stream) {
        this.streamId = stream.id;

        log.debug(`${this.getLogId()} setting stream`);
        this._stream = stream;
        this._headers = new Map();


        this._stream.once('response', (headers) => {
            log.debug(`${this.getLogId()} stream event 'response'`);

            this.emit('response', headers);

            // since streams will never emit a close event when
            // the data is not soncumed it can happen that teh
            // user forgets to consume the data and the stream
            // will never resolve which will result in memory leaks.
            //
            // this will emit a warning if the user does not consume
            // the data in a timely manner.
            this._dataConsumedTimeout = setTimeout(() => {
                //if (!stream.readableDidRead) {
                    log.warn(`${this.getLogId()} stream data not consumed within 10 000 msces. Your application will leak memrory! Please call reponse.getData() to consume the data.`);
                //}
            } , 10000);
        });

        this._stream.once('close', () => {
            clearTimeout(this._dataConsumedTimeout);

            log.debug(`${this.getLogId()} stream event 'close'`);
            this._handleDestroyedStream();
        });

        this._stream.once('pipe', () => {
            clearTimeout(this._dataConsumedTimeout);
        });

        this._stream.once('aborted', () => {
            this._streamFailed = true;
        });
        
        this._stream.once('error', (err) => {
            this._streamFailed = true;
            log.debug(`${this.getLogId()} stream event 'error'`);

            if (err.message.includes('NGHTTP2_ENHANCE_YOUR_CALM')) {
                log.warn(`NGHTTP2_ENHANCE_YOUR_CALM - need to slow down: ${err.message}`);
                // close the stream, tell the session creator to back off a bit
                this.emit('enhance_your_calm');
            }

            this._handleDestroyedStream(err);
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
            if (this._streamFailed) {
                throw new Error(`${this.getLogId()} Cannot get data from stream, stream has ended abnormally`);
            } else {
                return undefined;
            }
        }

        return new Promise((resolve, reject) => {
            let dataBuffer;

            this._stream.on('data', (chunk) => {
                // make sure to not print warnings as long as data is conumed
                clearTimeout(this._dataConsumedTimeout);

                log.debug(`${this.getLogId()} stream event 'data'`);
                if (!dataBuffer) dataBuffer = chunk;
                else dataBuffer += chunk;
            });

            this._stream.once('end', () => {
                log.debug(`${this.getLogId()} stream event 'end'`);
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
        log.debug(`${this.getLogId()} _handleDestroyedStream() method was called`);
        if (err) {
            log.debug(`[${this.identifier}] emit event 'error'`);
            this.emit('error', err);
        }

        this._end(err);
    }


    /**
     * clean up events in preparation for the session termination
     */
    _end(err) {
        if (this._stream) this._stream.removeAllListeners();
    
        // tell the outside that the stream has ended
        log.debug(`${this.getLogId()} emit event 'end'`);
        this.emit('end', err);

        // remove all event handlers
        this.removeAllListeners();

        // remove all references
        this._stream = null;
        this._request = null;
    }

    

    end(code) {
        log.debug(`${this.getLogId()} end() method was called`);
        this.getStream().close(code);
    }
}