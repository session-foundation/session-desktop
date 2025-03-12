#!/bin/python3
import re
from typing import List, Tuple

OUTPUT_FILE = "./ts/localization/locales.ts"


def wrapValue(value):
    """
    Wraps the given value in single quotes if it contains any characters other than letters, digits, or underscores.

    Args:
      value (str): The value to be wrapped.

    Returns:
      str: The wrapped value if it contains any special characters, otherwise the original value.
    """
    if re.search(r"[^a-zA-Z0-9_]", value):
        return f"'{value}'"
    return value


def parseValue(value):
    """
    Parses the given value by replacing single quotes with escaped single quotes.

    Args:
      value (str): The value to be parsed.

    Returns:
      str: The parsed value with escaped single quotes.
    """
    return value.replace("'", "\\'")


def generate_js_object(data):
    """
    Generate a JavaScript object from a dictionary.

    Args:
      data (dict): The dictionary containing key-value pairs.

    Returns:
      str: A string representation of the JavaScript object.
    """
    js_object = "{\n"
    for key, value in data.items():
        js_object += f"  {wrapValue(key)}: '{parseValue(value)}',\n"
    js_object += "}"
    return js_object

def escape_str(value: str):
    """
    Escapes some chars breaking the .ts otherwise: "\n" to "\\n" and "\"" to "\\\""
    """
    return value.replace("\n", "\\n").replace("\"", "\\\"")


def extract_vars(text):
    # Use a regular expression to find all strings inside curly braces
    vars = re.findall(r'\{(.*?)\}', text)
    return vars


def vars_to_record(vars):
    arr = []
    for var in vars:
        to_append = '' + var + ': ' + ('"number"' if var == 'count' or var == 'found_count' else '"string"')
        if to_append not in arr:
          arr.append(to_append)

    # print(arr)
    if not arr:
        return ''
    return "{" + ', '.join(arr) + "}"



def args_to_type(args):
   return args if args else 'undefined,'


def generate_type_object(locales):
    """
    Generate a JavaScript type from a dictionary.

    Args:
      data (dict): The dictionary containing key-value pairs.

    Returns:
      str: A string representation of the JavaScript object.
    """
    js_object = "{\n"
    js_plural_object_container = "{\n"
    plural_pattern = r"(zero|one|two|few|many|other)\s*\[([^\]]+)\]"

    for key, value_en in locales['en'].items():
        if value_en.startswith("{count, plural, "):
            extracted_vars_en = extract_vars(value_en)
            plurals_other = [[locale, data.get(key, "")] for locale, data in locales.items()]
            en_plurals_with_token = re.findall(plural_pattern, value_en)

            if not en_plurals_with_token:
               raise ValueError("invalid plural string")

            all_locales_plurals = []

            extracted_vars = extract_vars(en_plurals_with_token[0][1])
            if('count' not in extracted_vars):
                extracted_vars.append('count')

            for plural in plurals_other:
              js_plural_object = ""

              locale_key = plural[0].replace("_","-") # 'lo', 'th', 'zh-CN', ....
              plural_str = plural[1]

              plurals_with_token = re.findall(plural_pattern, plural_str)


              all_locales_strings = []
              as_record_type_en = vars_to_record(extracted_vars)

              for token, localized_string in plurals_with_token:
                if localized_string:
                  to_append = ""
                  to_append += token
                  to_append += f": \"{escape_str(localized_string)}\""
                  all_locales_strings.append(to_append)

              # if that locale doesn't have translation in plurals, add the english hones
              if not len(all_locales_strings):
                 for plural_en_token, plural_en_str in en_plurals_with_token:
                    all_locales_strings.append(f"{plural_en_token}: \"{escape_str(plural_en_str)}\"")
              js_plural_object += f"    {wrapValue(locale_key)}:"
              js_plural_object += "{\n      "
              js_plural_object += ",\n      ".join(all_locales_strings)
              js_plural_object += "\n    },"

              all_locales_plurals.append(js_plural_object)
            js_plural_object_container += f'  {wrapValue(key)}: {{\n{"\n".join(all_locales_plurals)}\n    args: {args_to_type(as_record_type_en)}\n  }},\n'

        else:
          extracted_vars_en = extract_vars(value_en)
          as_record_type_en = vars_to_record(extracted_vars_en)
          other_locales_replaced_values = [[locale, data.get(key, "")] for locale, data in locales.items()]

          all_locales_strings = []
          for locale, replaced_val in other_locales_replaced_values:
            if replaced_val:
              all_locales_strings.append(f'{wrapValue(locale.replace("_","-"))}: "{escape_str(replaced_val)}"')
            else:
              all_locales_strings.append(f'{wrapValue(locale.replace("_","-"))}: "{escape_str(value_en)}"')

          # print('key',key, " other_locales_replaced_values:", other_locales_replaced_values)
          js_object += f'  {wrapValue(key)}: {{\n      {",\n      ".join(all_locales_strings)},\n      args: {args_to_type(as_record_type_en)}\n  }},\n'

    js_object += "}"
    js_plural_object_container += "}"
    return js_object,js_plural_object_container


DISCLAIMER = """
// This file was generated by a script. Do not modify this file manually.
// To make changes, modify the corresponding JSON file and re-run the script.

"""


def generateLocalesType(locale, data):
    """
    Generate the locales type and write it to a file.

    Args:
      locale: The locale dictionary containing the localization data.
    """
    # write the locale_dict to a file
    with open(OUTPUT_FILE, "w", encoding='utf-8') as ts_file:
        ts_file.write(
            f"{DISCLAIMER}"
        )
        ts_file.write(
            f"export const {locale} = {generate_js_object(data)} as const;\n"
        )
        ts_file.write(
            f"\nexport type Dictionary = typeof en;\n"
        )


    return f"Locales generated at: {OUTPUT_FILE}"


def generateLocalesMergedType(locales):
    """
    Generate the locales type and write it to a file.

    Args:
      locale: The locale dictionary containing the localization data.
    """

    # write the locale_dict to a file
    with open(OUTPUT_FILE, "w", encoding='utf-8') as ts_file:
        ts_file.write(
            f"{DISCLAIMER}"
        )

        dicts = generate_type_object(locales)

        dictVar = "simpleDictionary"
        pluralDictVar = "pluralsDictionary"


        ts_file.write(f"""
export const {dictVar} = {dicts[0]} as const;

export const {pluralDictVar} = {dicts[1]} as const;
""")

    return f"Locales generated at: {OUTPUT_FILE}"

