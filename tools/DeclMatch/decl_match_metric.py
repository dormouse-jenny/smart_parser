import json
import argparse

class TMatchInfo:

    def __init__(self):
        self.true_positive = []
        self.false_positive = []
        self.false_negative = []
        self.f_score= 1.0

    def dump_comparings(self, input_id, worker_id, input, title, errors):
        for x in input:
            errors.append("\t".join((input_id, worker_id, title, x)))

    def dump(self, input_id, worker_id, errors):
        self.dump_comparings(input_id, worker_id, self.true_positive, "TP", errors)
        self.dump_comparings(input_id, worker_id, self.false_positive, "FP", errors)
        self.dump_comparings(input_id, worker_id, self.false_negative, "FN", errors)

    def dump_type_errors(self, input, title, errors):
        for x in input:
            errors.append("\t".join((title, x)))

    def dump_errors(self):
        errors = []
        self.dump_type_errors(self.false_positive, "FP", errors)
        self.dump_type_errors(self.false_negative, "FN", errors)
        return errors


def read_field_to_compare(dct, field_name):
    value = dct.get(field_name, "")
    if value is None:
        return ""
    value = str(value)
    value = value.strip("\n \r\t")
    value = value.replace(" ", "")
    value = value.replace(u" ", "")
    value = value.replace("\n", "")
    value = value.replace("\\r", "")
    value = value.replace("\r", "")
    value = value.lower()
    if field_name == "country_raw":
        if value in {"россия", "российскаяфедерация", "рф"}:
            value = "россия"

    return value

def  check_equal_value(d1, d2, field_name):
    v1 = read_field_to_compare(d1, field_name)
    v2 = read_field_to_compare(d2, field_name)
    if v1 == v2:
        return (True, v1, v2)
    if v1 == "" or v2 == "":
        return (False, v1, v2)
    try:
        f1 = float(v1.replace(",", "."))
        f2 = float(v2.replace(",", "."))
        if f1 == f2:
            return True, v1, v2
    except:
        pass
    return (False, v1, v2)


def check_field (person1, person2, parent_field, field_name, match_info):
    (result, value1, value2) = check_equal_value(person1, person2, field_name)
    if not result:
        if value2 is not None:
            match_info.false_positive.append(parent_field + "/" + field_name)
        if value1 is not None:
            match_info.false_negative.append(parent_field + "/" + field_name)
        return False
    else:
        if value1 is  not None:
            match_info.true_positive.append(parent_field + "/" + field_name)
        return True


def get_property(person, field_name, relative):
    for p in person.get(field_name, []):
        if p.get('relative') == relative:
            return p
    return {}


def is_null(v):
    return v is None or len(v) == 0


def are_equal_realty(p1, p2):
    return ( 
             check_equal_value(p1, p2, "own_type_raw")[0] and
             ( check_equal_value(p1, p2, "text")[0] or
             check_equal_value(p1, p2, "type_raw")[0] ) and
             check_equal_value(p1, p2, "square_raw")[0] and
             check_equal_value(p1, p2, "relative")[0] and
             check_equal_value(p1, p2, "country_raw")[0] and
             check_equal_value(p1, p2, "own_type_by_column_type")[0]);


def describe_realty(p):
    return u"real estate {0}, {1}, {2}, {3}, {4} relative={5}".format(
        p.get("text", "").replace("\n", "\\n"),
        p.get("type_raw", "").replace("\n", "\\n"),
        p.get("own_type_raw", ""),
        p.get("own_type_by_column", ""),
        p.get("square_raw"),
        p.get("relative"))


def are_equal_vehicle(p1, p2):
    return (
             check_equal_value(p1, p2, "text")[0] and
             check_equal_value(p1, p2, "relative")[0]);


def describe_vehicle(p):
    return u"vehicle {0}, relative={1}".format(
        p.get("text", "").replace("\n", "\\n"),
        p.get("relative"))


def are_equal_income(p1, p2):
    return check_equal_value(p1, p2, "relative")[0] and check_equal_value(p1, p2, "size_raw")[0];


def describe_income(p):
    return u"income {0}, relative={1}".format(
        str(p.get("size_raw", "")).replace("\n", "\\n"),
        p.get("relative"))


def check_set_field(field1, field2, are_equal_func, describe_func, match_info ):
    used = set()
    for p1 in field1:
        found = False
        for i in range(len(field2)):
            p2 = field2[i]
            if i not in used and are_equal_func(p1, p2):
                found = True
                used.add( i )
                match_info.true_positive.append (describe_func(p1))
                break
        if not found:
            match_info.false_negative.append(describe_func(p1))
    for i in range(len(field2)):
        if i not in used:
            match_info.false_positive.append(describe_func(field2[i]))


def calc_decl_match_one_pair(json1, json2):
    match_info = TMatchInfo()
    if len(json1.get('persons', [])) == 0 and len(json2.get('persons', [])) == 0:
        match_info.f_score = 1.0
        return match_info
    elif len(json1['persons']) == 0 or len(json2['persons']) == 0:
        match_info.f_score = 0
        return match_info
    person1 = json1['persons'][0]
    person2 = json2['persons'][0]
    person_info_1 = person1.get('person', {})
    person_info_2 = person2.get('person', {})
    if not check_field(person_info_1, person_info_2,  "person",  "name_raw", match_info):
        match_info.f_score = 0
        return match_info
    check_field(person_info_1, person_info_2, "person", "role", match_info)
    check_field(person_info_1, person_info_2, "person", "department", match_info)
    check_field(person1, person2, "", "year", match_info)
    check_set_field(person1.get('incomes', []),
                    person2.get('incomes', []),
                    are_equal_income,
                    describe_income,
                    match_info)
    check_set_field(person1.get('vehicles', []),
                    person2.get('vehicles', []),
                    are_equal_vehicle,
                    describe_vehicle,
                    match_info)
    check_set_field(person1.get('real_estates', []),
                    person2.get('real_estates', []),
                    are_equal_realty,
                    describe_realty,
                    match_info)
    tp = len(match_info.true_positive)
    fp = len(match_info.false_positive)
    fn = len(match_info.false_negative)
    prec = tp /  (tp + fp + 1.E-25)
    recall = tp / (tp + fn + 1.E-25)
    match_info.f_score = round(2 * prec * recall / (prec + recall), 4)
    return match_info


def trunctate_json(j):
    persons =  j.get('persons', [{}])
    if len(persons) == 0:
        p = {}
    else:
        p = persons[0]
    person_info = p.get('person', {})
    res = {
        'person': {
            'name_raw': person_info.get('name_raw', ''),
            'role': person_info.get('role', ''),
            'department': person_info.get('department', '')
        },
        'year': p.get('year', ''),
        'vehicles': [ ],
        'incomes': [],
        'real_estates': []
    }
    for v in p.get('vehicles', []):
        res['vehicles'].append ({'text': v.get('text', ''), 'relative': v.get('relative', '')})
    for v in p.get('incomes', []):
        res['incomes'].append ({'size_raw': v.get('size_raw', v.get('size')), 'relative': v.get('relative', '')})
    for v in p.get('real_estates', []):
        res['real_estates'].append ({
            'own_type_raw': v.get('own_type_raw', ''),
            'text': v.get('text', ''),
            'type_raw': v.get('type_raw', ''),
            'square_raw': v.get('square_raw', ''),
            'own_type_by_column': v.get('own_type_by_column', ''),
            'country_raw': v.get('country_raw', ''),
            'relative': v.get('relative', ''),
        })
    res['vehicles'] = sorted( res['vehicles'], key=lambda x: json.dumps(x) )
    res['incomes'] = sorted( res['incomes'], key=lambda x: json.dumps(x))
    res['real_estates'] = sorted( res['real_estates'], key=lambda x: json.dumps(x))
    return res


def  add_html_table_row(cells, make_bold=False):
    res = "<tr>"
    for c in cells:
        res  += "  <td"
        if c["mc"] > 1:
            res += " colspan=" + str(c["mc"])
        res += ">"
        if make_bold: res += "<b>";
        res += c["t"].replace("\n", '<br/>')
        if make_bold: res += "</b>";
        res += "</td>\n"
    return res + "</tr>\n"


def convert_to_html(jsonStr, maintag="html"):
    data = json.loads(jsonStr)
    res = "<"+ maintag +">"
    if data.get('Title') != None:
        res += "<h1>" +  data['Title'] + "</h1>\n"
    res += "<table border=1>\n"
    res += "<thead>\n"
    for r in  data["Header"]:
        res += add_html_table_row(r, True)
    res += "</thead>\n"
    res += "<tbody>\n"
    for r in  data["Section"]:
        res += add_html_table_row(r, True)
    for r in  data["Data"]:
        res += add_html_table_row(r)
    res += "</tbody>\n"
    res += "</table>"
    res += "</" + maintag + ">"
    return res;

def get_check_url(task):
    ass_link = task.get('ASSIGNMENT:link', "")
    if ass_link == "":
        return ""
    pool = ass_link.split('/')[4]
    PROJECT_ID = "22283"
    "https://toloka.yandex.ru/requester/project/22283/pool/5762585/assignments/000057ee19--5d29cf67c43d7e011d61e9fa?workerId=154ca43f5d4497041f35dda32a23b94d"
    url = "https://toloka.yandex.ru/requester/project/{}/pool/{}/assignments/{}?workerId={}".format(
        PROJECT_ID,
        pool,
        task.get('ASSIGNMENT:assignment_id', 'unk'),
        task.get('ASSIGNMENT:worker_id', 'unk')
    )
    return url

def dump_conflict (task, res1, res2, match_info, conflict_file):
    res = "<div>\n"
    res += "<table border=1> <tr>\n"

    res += "<tr>"
    res += "<td colspan=3><h1>"
    res += "f-score={}\n".format(match_info.f_score)
    res += " worker_id={}\n".format(task.get('ASSIGNMENT:worker_id', "unknown"))
    res += " input_id={}\n".format(task['INPUT:input_id'])
    res += " line_no={}\n".format(task['input_line_no'])
    res += " <a href={}> show link</a>\n".format(task.get('ASSIGNMENT:link', ""))
    res += " <a href={}> check link</a>\n".format(get_check_url(task))  # может не работать

    res += "</h1>"
    res += "</td></tr>"

    res += "<td width=30%>\n"

    input_json = task["INPUT:input_json"]
    res += convert_to_html(input_json, "div")
    res += "</td>\n"

    res += "<td width=30%>"
    res += res1[0] + "<br/>"
    res += "<textarea cols=80 rows=90>"
    res += json.dumps(res1[1], indent=4, ensure_ascii=False)
    res += "</textarea>"
    res += "</td>\n"

    res += "<td>"
    res += res2[0] + "<br/>"
    res += "<textarea cols=80 rows=90>"
    res += json.dumps(res2[1], indent=4, ensure_ascii=False)
    res += "</textarea>"
    res += "</td>\n"

    res += "</tr><tr>\n"
    res  += "<td colspan=3>"
    res += "<h1>"
    res += "f-score={}".format(match_info.f_score) + "<br/>"
    res += "<br/>".join(match_info.dump_errors())
    res += "</h1>"
    res += "\n</tr></table>"
    res  += "</td>"
    conflict_file.write(res)


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('json', nargs='+')
    return parser.parse_args()


if __name__ == '__main__':
    args = parse_args()
    j1 = None
    j2 = None
    with open (args.json[0], "r", encoding="utf8") as f1:
        j1 = json.load(f1)
    with open (args.json[1], "r", encoding="utf8") as f2:
        j2 = json.load(f2)
    match_info = calc_decl_match_one_pair(j1,  j2)
    errors = []
    match_info.dump("","", errors)
    for e in errors:
        print (e)