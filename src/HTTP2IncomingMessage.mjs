import EventEmitter from 'events';

export default class HTTP2IncomingMessage extends EventEmitter {

    constructor({
        stream,
        headers,
    }) {
        super();
        
        this._stream = stream;
        this._headers = headers;
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
                    if (contentType === 'application/json') {
                        try {
                            this._data = JSON.parse(buffer.toString());
                        } catch (e) {
                            throw new Error(`Failed to decode json: ${e.message}`);
                        }
                    } else if (contentType.startsWith('text/')) {
                        this._data = buffer.toString();
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

            this._stream.on('end', () => {
                resolve(dataBuffer);
            });

            this._stream.on('error', reject);
        });
    }





    /**
    * get the bare stream
    */
    stream() {
        return this._stream;
    }
}