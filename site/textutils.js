let g_tLuaKeywords = {
    "and": true,
    "break": true,
    "do": true,
    "else": true,
    "elseif": true,
    "end": true,
    "false": true,
    "for": true,
    "function": true,
    "if": true,
    "in": true,
    "local": true,
    "nil": true,
    "not": true,
    "or": true,
    "repeat": true,
    "return": true,
    "then": true,
    "true": true,
    "until": true,
    "while": true,
}

export function serialize(obj, cur_indent) {
  if (!cur_indent) {
    cur_indent = "";
  }
  if (typeof obj == "string") {
    let value = "\"";
    for (let j=0; j < obj.length; j++) {
      let char = obj.charCodeAt(j);
      if (char < 33 || char > 126) {
        value += "\\x" + ("0" + char.toString(16)).slice(-2);
      } else if (char == 92) {
        value += "\\\\";
      } else if (char == 34) {
        value += "\\\"";
      } else {
        value += obj[j]
      }
    }
    return value + "\"";
  } else if (typeof obj == "number") {
    if (obj !== obj) {
      return "0/0";
    } else if (obj == Number.POSITIVE_INFINITY) {
      return "1/0";
    } else if (obj == Number.NEGATIVE_INFINITY) {
      return "-1/0";
    } else {
      return obj.toString();
    }
  } else if (typeof obj == "boolean") {
    return obj.toString();
  } else if (obj === null) {
    return "nil";
  } else if (typeof obj == "object") {
    if (Object.keys(obj).length == 0) {
      return "{}";
    } else {
      let [open, sub_indent, open_key, close_key, equal, comma] = ["{\n", cur_indent+ "  ", "[ ", " ] = ", " = ", ",\n"];
      let result = open;
      let seen_keys = {};
    for (let i=0; obj[i]!==undefined; i++) {
      seen_keys[i] = true;
      result = result + sub_indent + serialize(obj[i], sub_indent) + comma;
    }
    for (const [key, value] of Object.entries(obj)) {
        if (!seen_keys[key]) {
          result += sub_indent;
          if (typeof key == "string" && !g_tLuaKeywords[key] && /^[a-zA-Z_][\w]*$/.test(key)) {
            result += key + equal + serialize(value, sub_indent) + comma;
          } else {
            result += open_key + serialize(key, sub_indent) + close_key + serialize(value, sub_indent) + comma;
          }
        }
      }
      result = result + cur_indent + "}";
      return result;
    }
  } else {
    console.warn("Not implemented: {obj}...")
  }
}

