#!/bin/python3
import re

OUTPUT_FILE = "./ts/localization/locales.ts"


# Define the mapping of special fields to their types and corresponding "WithX"
with_map = {
    ("name", "string"): "WithName",
    ("group_name", "string"): "WithGroupName",
    ("community_name", "string"): "WithCommunityName",
    ("other_name", "string"): "WithOtherName",
    ("author", "string"): "WithAuthor",
    ("emoji", "string"): "WithEmoji",
    ("emoji_name", "string"): "WithEmojiName",
    ("admin_name", "string"): "WithAdminName",
    ("time", "string"): "WithTime",
    ("time_large", "string"): "WithTimeLarge",
    ("time_small", "string"): "WithTimeSmall",
    ("disappearing_messages_type", "string"): "WithDisappearingMessagesType",
    ("conversation_name", "string"): "WithConversationName",
    ("file_type", "string"): "WithFileType",
    ("date", "string"): "WithDate",
    ("date_time", "string"): "WithDateTime",
    ("message_snippet", "string"): "WithMessageSnippet",
    ("query", "string"): "WithQuery",
    ("version", "string"): "WithVersion",
    ("information", "string"): "WithInformation",
    ("device", "string"): "WithDevice",
    ("percent_loader", "string"): "WithPercentLoader",
    ("message_count", "string"): "WithMessageCount",
    ("conversation_count", "string"): "WithConversationCount",
    ("found_count", "number"): "WithFoundCount",
    ("hash", "string"): "WithHash",
    ("url", "string"): "WithUrl",
    ("account_id", "string"): "WithAccountId",
    ("count", "number"): "WithCount",
    ("service_node_id", "string"): "WithServiceNodeId",
    ("limit", "string"): "WithLimit",
    ("relative_time", "string"): "WithRelativeTime",
    ("icon", "string"): "WithIcon",
    ("storevariant", "string"): "WithStoreVariant",
    ("min", "string"): "WithMin",
    ("max", "string"): "WithMax",
}


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



def vars_to_record_ts(vars):
    arr = []
    for var in vars:
        to_append = [var, 'number' if var == 'count' or var == 'found_count' else 'string']
        if to_append not in arr:
          arr.append(to_append)

    return arr




def vars_to_record(vars):
    arr = []
    for var in vars:
        to_append = '' + var + ': ' + ('"number"' if var == 'count' or var == 'found_count' else '"string"')
        if to_append not in arr:
          arr.append(to_append)

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
    js_object_no_args = "{\n"
    js_object_with_args = "{\n"
    js_plural_object_container_with_args = "{\n"
    plural_pattern = r"(zero|one|two|few|many|other)\s*\[([^\]]+)\]"

    tokens_simple_no_args = []
    tokens_simple_with_args = {}
    tokens_plurals_with_args = {}

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
            js_plural_object_container_with_args += f'  {wrapValue(key)}: {{\n{"\n".join(all_locales_plurals)}\n  }},\n'
            tokens_plurals_with_args[key] = vars_to_record_ts(extracted_vars)

        else:
          extracted_vars_en = extract_vars(value_en)
          other_locales_replaced_values = [[locale, data.get(key, "")] for locale, data in locales.items()]

          all_locales_strings = []
          for locale, replaced_val in other_locales_replaced_values:
            if replaced_val:
              all_locales_strings.append(f'{wrapValue(locale.replace("_","-"))}: "{escape_str(replaced_val)}"')
            else:
              all_locales_strings.append(f'{wrapValue(locale.replace("_","-"))}: "{escape_str(value_en)}"')

          if extracted_vars_en:
            js_object_with_args += f'  {wrapValue(key)}: {{\n      {",\n      ".join(all_locales_strings)},\n }},\n'
            tokens_simple_with_args[key] = vars_to_record_ts(extracted_vars_en)
          else:
            js_object_no_args += f'  {wrapValue(key)}: {{\n      {",\n      ".join(all_locales_strings)},\n  }},\n'
            tokens_simple_no_args.append(key)

    tokens_simple_no_args_str = "\n    '" + "' |\n    '".join(tokens_simple_no_args) + "'"

    js_object_no_args += "}"
    js_object_with_args += "}"
    js_plural_object_container_with_args += "}"

    dicts = {
        "simple_no_args": js_object_no_args,
        "simple_with_args": js_object_with_args,
        "plurals_with_args": js_plural_object_container_with_args,
        "tokens_simple_no_args_str": tokens_simple_no_args_str,
        "tokens_simple_with_args": tokens_simple_with_args,
        "tokens_plural_with_args": tokens_plurals_with_args,
    }
    return dicts


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


def format_tokens_with_named_args(token_args_dict):
    result = []

    for token, args in token_args_dict.items():
        extras = []
        with_types = []

        for arg_name, arg_type in args:
            key = (arg_name, arg_type)
            if key in with_map:
                with_types.append(with_map[key])
            else:
                extras.append(f"{arg_name}: {arg_type}")

        # Join parts
        joined = " & ".join(with_types)
        if extras:
            extras_str = "{ " + ", ".join(extras) + " }"
            joined = f"{joined} & {extras_str}" if joined else extras_str

        result.append(f"   {token}: {joined}")

    return "{\n" + ",\n".join(result) +"\n}"


def generate_with_types(with_map):
    lines = []
    for (arg_name, arg_type), type_name in with_map.items():
        lines.append(f"type {type_name} = {{{arg_name}: {arg_type}}};")
    return "\n".join(lines)




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

        ts_file.write("import type { CrowdinLocale } from './constants';\n")

        dicts = generate_type_object(locales)

        tokens_simple_with_args = dicts['tokens_simple_with_args']
        tokens_plural_with_args = dicts['tokens_plural_with_args']

        tokens_union_simple_args = format_tokens_with_named_args(tokens_simple_with_args)
        tokens_union_plural_args = format_tokens_with_named_args(tokens_plural_with_args)


        ts_file.write(f"""
{generate_with_types(with_map)}

export type TokenSimpleNoArgs = {dicts['tokens_simple_no_args_str']};

export type TokensSimpleAndArgs = {tokens_union_simple_args};

export type TokensPluralAndArgs = {tokens_union_plural_args};

export type TokenSimpleWithArgs = {"\n    '" + "' |\n    '".join(list(tokens_simple_with_args.keys())) + "'"}

export type TokenPluralWithArgs = {"\n    '" + "' |\n    '".join(list(tokens_plural_with_args.keys())) + "'"}

export const simpleDictionaryNoArgs: Record<
  TokenSimpleNoArgs,
  Record<CrowdinLocale, string>
> = {dicts['simple_no_args']} as const;


export const simpleDictionaryWithArgs: Record<
  TokenSimpleWithArgs,
  Record<CrowdinLocale, string>
> = {dicts['simple_with_args']} as const;

export const pluralsDictionaryWithArgs = {dicts['plurals_with_args']} as const;

""")


    return f"Locales generated at: {OUTPUT_FILE}"

