import { Hct, argbFromHex } from '@material/material-color-utilities';

export let mcu = {
  Hct: Hct,
  argbFromHex: argbFromHex,
};

import { parse } from 'luaparse';
import { isNull, isBoolean, isNumber, isString, isArray, isObject, isEmpty, fromPairs, keys, map, repeat } from 'lodash';

export let luaparse = {
  parse: parse,
  isNull: isNull,
  isBoolean: isBoolean,
  isNumber: isNumber,
  isString: isString,
  isArray: isArray,
  isObject: isObject,
  isEmpty: isEmpty,
  fromPairs: fromPairs,
  keys: keys,
  map: map,
  repeat: repeat,
};
