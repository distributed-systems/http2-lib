'use strict';


import types from '../es-modules/distributed-systems/types/v1.0.0/src/types.mjs';





export default class HTTP2OutgoingMessage {
    constructor() {
        this._headers = new Map();
    }




    /**
    * prepare the data for sending
    */
    prepareData() {
        if (this.hasData() && !this.hasHeader('content-type')) {
            const data = this.getData();

            if (types.buffer(data)) {

                // send as binary data
                this.setHeader('content-type', 'application/octet-stream');
            } else if (types.scalar(data)) {

                // send as text
                this.setHeader('content-type', 'text/text');
            } else {

                // try to encode as json
                if (types.function(data.toJSON)) {
                    this.setData(data.toJSON());
                    this.setHeader('content-type', 'application/json');
                } else {

                    try {
                        this.setData(JSON.stringify(data));
                        this.setHeader('content-type', 'application/json');
                    } catch (e) {

                        // send as string
                        if (types.function(data.toString)) {
                            this.setData(data.toString());
                            this.setHeader('content-type', 'text/text');
                        }
                    }
                }
            }
        }
    }



    /**
    * set the outgoing messages payload
    */
    setData(data) {
        this.data = data;
    }


    /**
    * checks if there is a payload
    */
    hasData() {
        return !!this.data;
    }



    /**
    * returns the data previously set on the outgoing message
    */
    getData() {
        return this.data;
    }



    /**
    * creates a plain js object containing the headers set by the user
    */
    getHeaderObject() {

        // create headers object
        const headers = {};

        for (const [header, value] of this._headers.entries()) {
            headers[header] = value;
        }

        return headers;
    }


    /**
    * check if a certain header was set
    */
    hasHeader(headerName) {
        return this._headers.has(headerName);
    }



    /**
    * get one header
    */
    getHeader(headerName) {
        return this._headers.get(headerName);
    }




    /**
    * get the header instance
    */
    getHeaders() {
        return this._headers;
    }
    



    /**
    * set one header
    *
    * @param {string} key - the name of the header
    * @param {string} value - the value of the header
    *
    * @returns {object} this
    */
    setHeader(key, value) {
        key = key.toLowerCase();

        if (!this._headers.has(key)) this._headers.set(key, value);
        else if (Array.isArray(this._headers.get(key))) this._headers.get(key).push(value);
        else this._headers.set(key, [this._headers.get(key), value]);

        return this;
    }


    /**
    * set multiple headers
    *
    * @param {(array|object)} headers - either an array containing array 
    *   with key & values or an object containing keys & values
    *
    * @returns {object} this
    */
    setHeaders(headers) {
        if (Array.isArray(headers)) {
            for (const [key, value] of headers) {
                this.setHeader(key, value);
            }
        } else if (headers !== null && typeof headers === 'object') {
            Object.keys(headers).forEach((key) => {
                this.setHeader(key, headers[key]);
            });
        } else throw new Error(`Cannot set headers, expected an object or an array, got '${typeof headers}'!`);

        return this;
    }
}