'use strict';



export default class HTTP2IncomingMessage {

    constructor({
        stream,
        headers,
    }) {
        this._stream = stream;
        this._headers = headers;
    }






    /**
    * check if a certain header was set
    */
    hasHeader(headerName) {
        return !!this._headers[headerName];
    }



    /**
    * get one header
    */
    getHeader(headerName) {
        return this._headers[headerName];
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
        const buffer = await this.getBuffer();
        let contentType = this.getHeader('content-type');

        if (contentType) contentType = contentType.toLowerCase();
        else return buffer;

        if (buffer && buffer.length) {
            if (contentType === 'application/json') {
                try {
                    return JSON.parse(buffer.toString());
                } catch (e) {
                    throw new Error(`Failed to decode json: ${e.message}`);
                }
            } else if (contentType.startsWith('text/')) {
                return buffer.toString();
            }
        } 

        return buffer;
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