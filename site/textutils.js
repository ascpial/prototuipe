import { luaparse } from './utils.js';

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

const escapeCodes = {
  "n": "\n",
  "\\": "\\",
  '"': '"',
  "'": "'",
  "[": "[",
  "]": "]",
}

function sanitizeString(str) {
  str = str.slice(1, str.length - 1);
  let escaping = false;
  let output = "";
  for (let i = 0; i < str.length; i++) {
    let c = str[i];
    if (c == "\\") {
      escaping = true;
    } else if (!escaping) {
      output = output + c;
    } else {
      if (c == "x") {
        let rawHex = str.slice(i + 1, i + 3);
        let charCode = parseInt(rawHex, 16);
        output = output + String.fromCharCode(charCode);
        i = i + 2;
      } else if (escapeCodes[c]) {
        output = output + escapeCodes[c];
      } else {
        throw "Unknown escape code " + c
      }
      escaping = false;
    }
  }
  return output;
}

// This section of code comes from https://github.com/kcwiki/lua-json/blob/master/index.js#L59C1-L107C2

const luaAstToJson = ast => {
  // literals
  if (['NilLiteral', 'BooleanLiteral', 'NumericLiteral'].includes(ast.type)) {
    return ast.value
  }
  if (ast.type === 'StringLiteral') {
    return sanitizeString(ast.raw);
  }
  // basic expressions
  if (ast.type === 'UnaryExpression' && ast.operator === '-') {
    return -luaAstToJson(ast.argument)
  }
  if (ast.type === 'Identifier') {
    return ast.name
  }
  // tables
  if (['TableKey', 'TableKeyString'].includes(ast.type)) {
    return { __internal_table_key: true, key: luaAstToJson(ast.key), value: luaAstToJson(ast.value) }
  }
  if (ast.type === 'TableValue') {
    return luaAstToJson(ast.value)
  }
  if (ast.type === 'TableConstructorExpression') {
    // this part has been modified
    let object = {};
    let index = 0;
    ast.fields.forEach(field => {
      const value = luaAstToJson(field);
      if (value.__internal_table_key) {
        object[value.key] = value.value;
      } else {
        object[index] = value;
        index++;
      }
    });
    return object
    // end modification
  }
  // top-level statements, only looking at the first statement, either return or local
  // todo: filter until return or local?
  if (ast.type === 'LocalStatement') {
    const values = ast.init.map(luaAstToJson)
    return values.length === 1 ? values[0] : values
  }
  if (ast.type === 'ReturnStatement') {
    const values = ast.arguments.map(luaAstToJson)
    return values.length === 1 ? values[0] : values
  }
  if (ast.type === 'Chunk') {
    return luaAstToJson(ast.body[0])
  }
  throw new Error(`can't parse ${ast.type}`)
}

// end

export function unserialize(string) {
  let ast = luaparse.parse("return " + string)
  return luaAstToJson(ast);
}

export function serialize(obj, cur_indent) {
  if (!cur_indent) {
    cur_indent = "";
  }
  if (typeof obj == "string") {
    let value = "\"";
    for (let j = 0; j < obj.length; j++) {
      let char = obj.charCodeAt(j);
      if (char < 33 || char > 126) {
        value += "\\x" + ("0" + char.toString(16)).slice(-2);
      } else if (char == 92) {
        value += "\\\\";
      } else if (char == 34) {
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
      let [open, sub_indent, open_key, close_key, equal, comma] = ["{\n", cur_indent + "  ", "[ ", " ] = ", " = ", ",\n"];
      let result = open;
      let seen_keys = {};
      for (let i = 0; obj[i] !== undefined; i++) {
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

// let test = { 1: 1, 2: 2, 3: 3, 4: "Hello", test: { "1then": 1, then: 3 } };

// console.log(unserialize(`{
//   {
//     {
//       "\\x20\\x20\\x20\\x94\\x20\\x20\\x97\\x20\\x9f\\x20\\x20\\x20",
//       "000000f0f000",
//       "ffffff0f0fff",
//     },
//     {
//       "\\x20\\x20\\x20\\x96\\x20\\x20\\x95\\x20\\x95\\x20\\x9f\\x20",
//       "000f00f0f0f0",
//       "fff0ff0f0f0f",
//     },
//   },
//   version = "1.0.0",
//   creator = "prototuipe",
//   width = 12,
//   height = 2,
//   animated = false,
// }`))

