import EventEmitter from 'events';



const ngErrors = new Map([
    [0, 'NGHTTP2_NO_ERROR'],
    [1, 'NGHTTP2_PROTOCOL_ERROR'],
    [2, 'NGHTTP2_INTERNAL_ERROR'],
    [3, 'NGHTTP2_FLOW_CONTROL_ERROR'],
    [4, 'NGHTTP2_SETTINGS_TIMEOUT'],
    [5, 'NGHTTP2_STREAM_CLOSED'],
    [6, 'NGHTTP2_FRAME_SIZE_ERROR'],
    [7, 'NGHTTP2_REFUSED_STREAM'],
    [8, 'NGHTTP2_CANCEL'],
    [9, 'NGHTTP2_COMPRESSION_ERROR'],
    [10, 'NGHTTP2_CONNECT_ERROR'],
    [11, 'NGHTTP2_ENHANCE_YOUR_CALM'],
    [12, 'NGHTTP2_INADEQUATE_SECURITY'],
    [13, 'NGHTTP2_HTTP_1_1_REQUIRED'],
]);



export default class HTTP2IncomingMessage extends EventEmitter {

    constructor({
        stream,
        headers,
    }) {
        super();
        
        this._stream = stream;
        this._headers = headers;
        this._sessionIsClosed = false;

        this.setUpSessionEvents(stream);
    }


    
    destroy() {
        if (this._stream) {
            this._stream.removeAllListeners();
            this._stream.destroy();
            this._stream = null;
        }
    }


    getIp() {
        return this._stream.session.socket.remoteAddress;
    }


    /**
     * check if the session of this stream gets closed while we're busy
     *
     * @param      {Stream}  stream  The stream
     */
    setUpSessionEvents(stream) {
        const goAwayListener = (errorCode, lastStreamID, opaqueData) => {
            this._sessionIsClosed = true;
            this._sessionErrorCode = errorCode;
            this._sessionErrorName = ngErrors.has(errorCode) ? ngErrors.get(errorCode) : 'N/A';
            this.emit('goaway', errorCode, lastStreamID, opaqueData);
        };

        // the stream may decide to go away
        stream.session.on('goaway', goAwayListener);


        const removeListener = () => {
            stream.removeListener('goaway', goAwayListener);
        };

        // remove the event handler after the sream is closed
        stream.on('close', removeListener);
        stream.on('error', removeListener);
    }




    /**
    * check if a certain header was set
    */
    hasHeader(headerName) {
        headerName = headerName.toLowerCase();
        return !!this._headers[headerName];
    }



    /**
    * get one header
    */
    getHeader(headerName) {
        headerName = headerName.toLowerCase();

        if (this.hasHeader('encoded-header-fields')) {
            const encodedHeaders = new Set(this._headers['encoded-header-fields'].split(','));

            if (encodedHeaders.has(headerName)) {
                return new Buffer(this._headers[headerName], 'base64').toString();
            }
        }

        return this._headers[headerName];
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
    * get the bare stream
    */
    stream() {
        return this._stream;
    }
}