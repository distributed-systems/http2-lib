import logd from 'logd';
import EventEmitter from 'events'


const log = logd.module('HTTP2IncomingMessage');



/**
 * on the server side: request
 * on the client side: response
 */

export default class HTTP2IncomingMessage extends EventEmitter {

    constructor(http2Stream = null, headers = {}) {
        super();
        
        this._headers = headers;

        if (http2Stream) {
            this.setStream(http2Stream);
        }
    }

    getStream() {
        return this._http2Stream;
    }


    getRawStream() {
        return this._http2Stream.getStream();
    }


    setStream(http2Stream) {
        this._http2Stream = http2Stream;

        this._http2Stream.once('end', (err) => {
            this._handleDestroyedStream(err);
        });
    }



    /**
     * Handle sessions that are destroyed
     * 
     * @param {Error} err 
     */
     _handleDestroyedStream(err) {
        if (err) {
            log.error(`Stream error: ${err.message}`, err);
            this.emit('error', err);
        }

        this._end(err);
    }


    /**
     * clean uop events in preparation for the session termination
     */
    _end(err) {
        // even if this handler is added before others it should
        // be called last
        setImmediate(() => {
             // make sure no events are handled anymore
            this._http2Stream.removeAllListeners();

            // tell the outside that the stream has ended
            this.emit('end', err);

            // remove all event handlers
            this.removeAllListeners();

            // remove all references
            this._http2Stream = null;
        });
    }


    streamIsClosed() {
        return this._http2Stream === null ? true : this._http2Stream.isClosed();
    }



    getIp() {
        return this._http2Stream.getIp();
    }




    /**
    * check if a certain header was set
    */
    hasHeader(headerName) {
        headerName = headerName.toLowerCase();
        const value = this._headers[headerName];
        return (Array.isArray(value) && value.length) || (typeof value === 'string' && value.trim().length);
    }



    /**
    * get one header
    */
    getHeader(headerName) {
        if (this.hasHeader(headerName)) {
            headerName = headerName.toLowerCase();
            const value = this._headers[headerName];

            if (this.hasHeader('encoded-header-fields')) {
                const encodedHeaders = new Set(this._headers['encoded-header-fields'].split(','));

                if (encodedHeaders.has(headerName)) {
                    return new Buffer.from(value, 'base64').toString();
                }
            }

            if (Array.isArray(value) && value.length === 1) {
                return value[0];
            }

            return value;
        }
    }



    /**
     * set a header value
     *
     * @param      {string}  key     The key
     * @param      {*}       value   The value
     */
    setHeader(headerName, value) {
        headerName = headerName.toLowerCase();
        this._headers[headerName] = value;
    }




    /**
    * get the header instance
    */
    getHeaders() {
        return this._headers;
    }






    /**
    * get data, text & json gets decoded automatically
    */
    async getData() {
        if (!this._data) {
            const buffer = await this.getBuffer();
            let contentType = this.getHeader('content-type');

            if (contentType) {
                contentType = contentType.toLowerCase();

                if (buffer && buffer.length) {
                    if (contentType.startsWith('application/json')) {
                        try {
                            this._data = JSON.parse(buffer.toString());
                        } catch (e) {
                            throw new Error(`Failed to decode json: ${e.message}`);
                        }
                    } else if (contentType.startsWith('text/')) {
                        this._data = buffer.toString();
                    } else {
                        this._data = buffer;
                    }
                }
            } else {
                this._data = buffer;
            }
        }
       
        return this._data;
    }






    /**
    * get all data as a single buffer
    */
    async getBuffer() {
        return this._http2Stream.getBuffer();
    }





    /**
    * get the bare stream
    */
    stream() {
        return this._http2Stream.getStream();
    }
}