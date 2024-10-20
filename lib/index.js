const core = require('@lumjs/core');
const clone = core.obj.clone;

const {F,O,B,N,S} = core.types;

const JSON_ALL = /^(\[.*?\]|\{.*?\})$/;
const JSON_ARR = /^\[.*?\]$/;
const JSON_OBJ = /^\{.*?\}$/;

/**
 * URL Hash management class.
 *
 * You can create an instance of this for any library that uses URL
 * hashes, and it supports a wide variety of URL hash functionality.
 *
 * @exports module:@lumjs/web-url-hash
 * 
 * @property {boolean} shortOpt  Allow short option fallback?
 * @property {boolean} autoArray Use smart array format detection?
 */
class URLHash
{
  /**
   * Create a URLHash instance.
   *
   * @param {object} opts  Named options to override default functionality.
   * @param {boolean} [opts.shortOpt=false]  Allow short option fallback.
   * @param {boolean|string} [opts.json=false] Allow JSON in hash?
   *
   *  If this is true we allow both JSON arrays and JSON objects.
   *  If 'array' we allow only arrays. If O we allow only objects.
   *
   * @param {boolean} [opts.autoArray=true] Use smart array format detection.
   *  Only applicable if 'json' is not false.
   *
   * @param {object} [opts.getters] Options for parsing Hash values.
   * @param {string|RegExp} [opts.getters.separate=';'] Split value for options.
   * @param {string|RegExp} [opts.getters.assign='='] Split value for assignments.
   * @param {string|RegExp} [opts.getters.true=/^(true|yes)%/i] Match value for true.
   * @param {string|RegExp} [opts.getters.false=/^(false|no)%/i] Match value for false.
   *
   * @param {object} [opts.setters] Options for serializing Hash values.
   * @param {string} [opts.setters.separate=';'] String for options.
   * @param {string} [opts.setters.assign='='] String for assignments.
   * @param {string} [opts.setters.true='true'] String for true.
   * @param {string} [opts.setters.false='false'] String for false.
   *
   * @param {function} [opts.getHash] A function to return the hash string. By default we return location.hash (the browser URL hash.)
   * @param {function} [opts.setHash] A function to set the hash string to a new value. By default we set location.hash.
   *
   */
  constructor (opts={})
  {
    this._getHash = (typeof opts.getHash === F) 
    ? opts.getHash 
    : () => location.hash;

    this._setHash = (typeof opts.setHash === F) 
    ? opts.setHash 
    : (newhash) => location.hash = newhash;

    this.shortOpt = (typeof opts.shortOpt === B)
    ? opts.shortOpt
    : false;

    this.autoArray = (typeof opts.autoArray === B)
    ? opts.autoArray
    : true;

    if ('json' in opts)
    { // Set the JSON parsing/serialization options.
      this.useJson(opts.json);
    }
    else
    { // Don't use JSON.
      this._json = null;
    }

    this._getters =
    { // Default getters.
      separate: ';',
      assign:   '=',
      true:    /^(true|yes)$/i,
      false:   /^(false|no)$/i,
    }

    this._setters =
    { // Default setters.
      separate: ';',
      assign:   '=',
      true:     'true',
      false:    'false',
    }

    if ('getters' in opts)
    {
      this.setGetters(opts.getters);
    }

    if ('setters' in opts)
    {
      this.setSetters(opts.setters);
    }
  }

  /**
   * Parse a URL Hash string into a query string like object.
   *
   * If an option does not have an assignment, it's value will be set to null.
   *
   * @param {object} [getOpts] Options
   * @param {object} [getOpts.defaults] Default values for the hash options.
   * @param {string} [getOpts.hash] Use this instead of the default hash.
   *
   */
  getOpts (getOpts={})
  {
    let hashOpts = (typeof getOpts.defaults === O && getOpts.defaults !== null) ? clone(getOpts.defaults) : {};

    let hash = 'hash' in getOpts ? getOpts.hash : this._getHash();

    if (hash && hash != '#')
    { // We have a hash, let's split it up.

      if (this._lastHash && this._lastOpts && this._lastHash === hash)
      { // The hash hasn't changed since last time, return the opts.
        return this._lastOpts;
      }

      // Remember this hash for next time.
      this._lastHash = hash;

      let sep = this._getters.separate;
      let ass = this._getters.assign;
      let tv  = this._getters.true;
      let fv  = this._getters.false;
      let jc  = this._json;

      function getVal (input)
      {
        if (jc && input.match(jc))
        {
          let output;
          try
          {
            output = JSON.parse(decodeURI(input));
          }
          catch (e) 
          {
            console.error("Invalid JSON in URL hash", input);
          }
          return output;
        }
        if (tv && input.match(tv))
        {
          return true;
        }
        if (fv && input.match(fv))
        {
          return false;
        }
        return input;
      }

      if (hash.substr(0,1) === '#')
      { // Remove the '#' character.
        hash = hash.substr(1);
      }
      else
      { // Show a warning in the logs.
        console.error("Hash string did not start with # character");
      }

      let segments = hash.split(sep);
      for (let s = 0; s < segments.length; s++)
      {
        let segment = segments[s];
        let assignment = segment.split(ass);
        if (assignment.length == 1)
        { // No assignment, set value to an explicit null.
          hashOpts[segment] = null;
        }
        else if (assignment.length == 2)
        { // Assignment of a name to a value. Check for special values.
          hashOpts[assignment[0]] = getVal(assignment[1]);
        }
        else
        { // Direct multiple value assignment, no magic values.
          hashOpts[assignment[0]] = assignment.slice(1);
        }
      }

      // Save the opts for cached hashes.
      this._lastOpts = hashOpts;
    }

    return hashOpts;
  }

  /**
   * Get a single Hash option.
   *
   * @param {string} name  The name of the option you want to find.
   * @param {object} [getOpts]   Options
   *
   * Note that the getOpts are passed to getOpts() as well, so any
   * options applicable to that method may also be specified.
   *
   * @param {mixed} [getOpts.default] The default value if nothing else matches.
   * @param {boolean} [getOpts.shortOpt] Override the 'shortOpt' option for this call.
   *
   * If 'shortOpt' is true (either globally, or just for this call), then
   * if the named hash option isn't found, but only a single hash option was 
   * defined, we assume the hash wasn't using named options at all, 
   * and the single option was the value itself.
   *
   */
  getOpt (name, getOpts={})
  {
    let shortOpt = 'shortOpt' in getOpts 
      ? getOpts.shortOpt
      : this.shortOpt;

    let hashOpts = this.getOpts(getOpts);

    if (hashOpts[name] !== undefined)
    { // A named option was found.
      return hashOpts[name];
    }
    else
    {
      let keys = Object.keys(hashOpts);
      if (shortOpt && keys.length == 1 && hashOpts[keys[0]] === null)
      { // Only one key, whose value is null. Return it.
        return keys[0];
      }
      else
      { // Nothing else matched, return the default.
        return getOpts.default;
      }
    }      
  }

  /**
   * Serialize an object into a URL Hash string.
   *
   * If an array value is found, how it's handled depends on the current
   * 'json'/useJson() property value. If we aren't serializing JSON, then
   * it will expect the array to contain only strings and/or values that
   * can be converted to strings, and it will output as:
   *
   *   name=value1=value2=value3
   *
   * If we have JSON serialization enabled, then the serialization format
   * depends on if 'autoArray' is true or false.
   *
   * If 'autoArray' is true (the default), we check every member of the
   * array to see the type, if all are S or N, we serialize
   * using the simple format above. If any value is something other than
   * a string or number, we serialize using JSON.
   *
   * If 'autoArray' is false and JSON serialization is enabled, we
   * always serialize arrays into JSON format.
   *
   * You probably don't need to run this method manually, see the
   * replace() and update() methods for the primary ways to call this.
   *
   * @param {object} obj       The object we are serializing.
   * @param {object} [setOpts]   Options specific to this method.
   * @param {boolean} [setOpts.autoArray] Override the 'autoArray' property for this call.
   *
   * @return string   The URL Hash string.
   */
  serialize (obj, setOpts={})
  {
    let autoArray = 'autoArray' in setOpts 
      ? setOpts.autoArray 
      : this.autoArray;

    let hashString = '#'; // Always start with a # character.
    let doneFirst = false;

    let sep = this._setters.separate;
    let assign = this._setters.assign;
    let tv = this._setters.true;
    let fv = this._setters.false;

    // An internal function to serialize an array using multiple assignment.
    function serializeArray (array)
    {
      let string = '';
      for (let a = 0; a < array.length; a++)
      {
        let item = array[a];
        if (typeof item === S || typeof item === N)
        { // Only strings and numbers are stringified in simple arrays.
          string += assign + item;
        }
        else
        { // Display a warning.
          console.error("Cannot serialize item into simple array", item);
        }
      }
      return string;
    }

    for (let key in obj)
    {
      let val = obj[key];
      if (doneFirst)
      { // Add a separator.
        hashString += sep;
      }
      else
      { // Mark that we've done the first option.
        doneFirst = true;
      }
      hashString += key;
      if (val === null)
      { // Null means there's no assignment to be done.
        continue;
      }
      if (val === true && tv)
      {
        hashString += assign + tv;
      }
      else if (val === false && fv)
      {
        hashString += assign + fv;
      }
      else if (typeof val === O)
      {
        if (Array.isArray(val))
        { // It's an array.
          if (this.serializeJsonArray())
          { // What we do next depends on autoArray setting.
            if (autoArray)
            {
              let useJson = false;
              for (let a = 0; a < val.length; a++)
              {
                let subval = val[a];
                if (typeof subval !== S && typeof subval !== N)
                { // Found something that can't be serialized.
                  useJson = true;
                  break;
                }
              }
              if (useJson)
              { // Serialize with JSON.
                hashString += assign + JSON.stringify(val);
              }
              else
              { // Serialize with multiple assignment.
                hashString += serializeArray(val);
              }
            }
            else
            { // Serialize with JSON.
              hashString += assign + JSON.stringify(val);
            }
          }
          else
          { // Serialize as a multiple assignment.
            hashString += serializeArray(val);
          }
        }
        else
        { // It's another kind of object.
          if (this.serializeJsonObject())
          {
            hashString += assign + JSON.stringify(val);
          }
          else
          {
            throw new Error("Cannot serialize object when JSON is disabled");
          }
        }
      }
      else if (typeof val === S || typeof val === N)
      { // Assign the value directly.
        hashString += assign + val;
      }
      else
      {
        throw new TypeError("Invalid valid type passed to serialize()");
      }
    }

    return hashString;
  }

  /**
   * Replace the referenced Hash string with a new serialized one.
   *
   * Serialize the object into a Hash string, then set the referenced
   * Hash to the new string. This is a way to completely rewrite the hash,
   * and is one of the primary serialization methods.
   *
   * @param {object} reps     The object we are serializing to the hash string.
   * @param {object} [setOpts]  Options to pass to serialize.
   *
   */
  replace (reps, setOpts)
  {
    const newstring = this.serialize(reps, setOpts);
    this._lastHash = newstring;
    this._lastOpts = reps;
    this._setHash(newstring);
    return this;
  }

  /**
   * Update the referenced Hash string.
   *
   * This is similar to replace() but it keeps existing properties already
   * in the hash that haven't been modified.
   *
   * If you want to remove an option from the existing hash, set it's
   * value to undefined in the updates object.
   *
   * This is the other primary serialization method, and will probably be
   * used even more than replace() since it respects existing values.
   *
   * @param {object} updates   Changes to make to the hash.
   * @param {object} [setOpts]   Options to pass to serialize.
   * @param {object} [getOpts]   Options to pass to getOpts.
   *
   */
  update (updates, setOpts, getOpts)
  {
    let current = this.getOpts(getOpts);
    for (let key in updates)
    {
      const val = updates[key];
      if (val === undefined)
      { // An undefined value was explicitly passed, remove the item.
        delete current[key];
      }
      else
      {
        current[key] = val;
      }
    }
    return this.replace(current, setOpts);
  }

  /**
   * Delete specific properties from the existing hash.
   *
   * @param {string[]} props - A list of properties to delete
   * @param {object} [setOpts] Options to pass to serialize.
   * @param {object} [getOpts] Options to pass to getOpts.
   * 
   */
  delete(props, setOpts, getOpts)
  {
    const updates = {};
    for (let p of props)
    {
      updates[p] = undefined;
    }
    return this.update(updates);
  }

  /**
   * Set a bunch of 'getters' properties at once.
   *
   * @param {object} obj   The properties you want to see.
   *
   * See constructor for valid 'getters' properties.
   */
  setGetters (obj)
  {
    if (typeof obj === O)
    {
      for (let key in obj)
      {
        let val = obj[key];
        this.setGetter(key, val);
      }
    }
    else
    {
      throw new Error("Invalid object passed to setGetters()");
    }

    return this;
  }

  /**
   * Set a bunch of 'setters' properties at once.
   *
   * @param {object} obj   The properties you want to see.
   *
   * See constructor for valid 'setters' properties.
   */
  setSetters (obj)
  {
    if (typeof obj === O)
    {
      for (let key in obj)
      {
        let val = obj[key];
        this.setSetter(key, val);
      }
    }
    else
    {
      throw new Error("Invalid object passed to setSetters()");
    }

    return this;
  }

  /**
   * Set a 'getters' property.
   *
   * @param {string} name   The property you want to set.
   * @param {mixed} value   The value you want to set.
   *
   * See constructor for valid 'getters' properties and accepted values.
   */
  setGetter (name, value)
  {
    if (name === 'true' || name === 'false')
    { // Either a string, RegExp, or false.
      if (typeof value === S || value === false
      || (typeof value === O && value instanceof RegExp))
      {
        this._getters[name] = value;
      }
      else
      {
        throw new Error("Invalid '"+name+"' value passed to setGetter()");
      }
    }
    else if (name === 'separate' || name === 'assign')
    { // These setters must be a string or RegExp.
      if (typeof value === S 
      || (typeof value === O && value instanceof RegExp))
      {
        this._getters[name] = value;
      }
      else
      {
        throw new Error("Invalid '"+name+"' value passed to setGetter()");
      }
    }
    else
    {
      throw new Error("Unknown getter name '"+name+"' passed to setGetter()");
    }

    return this;
  }

  /**
   * Set a 'setters' property.
   *
   * @param {string} name   The property you want to set.
   * @param {mixed} value   The value you want to set.
   *
   * See constructor for valid 'setters' properties and accepted values.
   */
  setSetter (name, value)
  {
    if (name === 'true' || name === 'false')
    { // Either a string or false.
      if (typeof value === S || value === false)
      {
        this._setters[name] = value;
      }
      else
      {
        throw new Error("Invalid '"+name+"' value passed to setSetter()");
      }
    }
    else if (name === 'separate' || name === 'assign')
    { // These setters must be a string.
      if (typeof value === S)
      {
        this._setters[name] = value;
      }
      else
      {
        throw new Error("Invalid '"+name+"' value passed to setSetter()");
      }
    }
    else
    {
      throw new Error("Unknown setter name '"+name+"' passed to setSetter()");
    }

    return this;
  }

  /**
   * Do we want to parse/serialize JSON values?
   *
   * @param {boolean|string} value  the 'json' value.
   *
   * See the constructor for valid 'json' values.
   */
  useJson (value)
  {
    if (value === false)
    { // Don't use JSON at all.
      this._json = null;
    }
    else if (value === true)
    { // Match arrays or objects.
      this._json = JSON_ALL;
    }
    else if (value === 'array')
    {
      this._json = JSON_ARR;
    }
    else if (value === O)
    {
      this._json = JSON_OBJ;
    }
    else
    {
      throw new Error("Invalid value passed to useJson()");
    }
  }

  /**
   * Can we serialize Arrays to JSON?
   *
   * @return boolean
   */
  serializeJsonArray ()
  {
    return (this._json === JSON_ARR || this._json === JSON_ALL);
  }

  /**
   * Can we serialize Objects to JSON?
   *
   * @return boolean
   */
  serializeJsonObject ()
  {
    return (this._json === JSON_OBJ || this.json === JSON_ALL);
  }

  /**
   * A static class method to create a new Hash and call getOpts() on it.
   *
   * @param {object} [getOpts]   Options to pass to getOpts.
   * @param {object} [hashOpts]  Options to pass to constructor.
   *
   * @return {object} The parsed hash options.
   */
  static getOpts (getOpts, hashOpts)
  {
    return new URLHash(hashOpts).getOpts(getOpts);
  }

  /**
   * A static class method to create a new Hash and call getOpt() on it.
   *
   * @param {string} name      The option name we want to get.
   * @param {object} [getOpts]   Options to pass to getOpt.
   * @param {object} [hashOpts]  Options to pass to constructor.
   *
   * @return mixed   The value returned from getOpt.
   */
  static getOpt (name, getOpts, hashOpts)
  {
    return new URLHash(hashOpts).getOpt(name, getOpts);
  }

  /**
   * A static class method to create a new Hash and call replace() on it.
   *
   * @param {object} reps      The reps to pass to replace.
   * @param {object} [setOpts]   Options to pass to replace.
   * @param {object} [hashOpts]  Options to pass to contructor.
   */
  static replace (reps, setOpts, hashOpts)
  {
    return new URLHash(hashOpts).replace(reps, setOpts);
  }

  /**
   * A static class method to create a new Hash and call update() on it.
   *
   * @param {object} updates    The updates to pass to update.
   * @param {object} [setOpts]    Set options to pass to update.
   * @param {object} [getOpts]    Get options to pass to update.
   * @param {object} [hashOpts]   Options to pass to constructor.
   */
  static update (updates, setOpts, getOpts, hashOpts)
  {
    return new URLHash(hashOpts).update(updates, setOpts, getOpts);
  }

}

module.exports = URLHash;
