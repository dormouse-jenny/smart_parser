import shutil
import sys
import os
import time
import argparse
from multiprocessing import Pool
from collections import defaultdict
import signal
import json
import csv
import shutil

DATA_FOLDER = "data"
#======================= copy data from drop box ========================
def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--toloka",  dest='toloka', help ="toloka assignments file")
    parser.add_argument("--smart-parser", dest='smart_parser')
    parser.add_argument("--dump-conflicts", dest='dump_conflicts')
    return parser.parse_args()


def input_html_file_name(input_id):
    global DATA_FOLDER
    return os.path.join(DATA_FOLDER, input_id + ".html")

def smart_parser_result_json_file(input_id):
    htmlfile = input_html_file_name(input_id);
    return  htmlfile[:htmlfile.rfind('.')] + ".json"

def avg(items):
    count = 0
    all_sum = 0.0
    for i in items:
        count += 1
        all_sum += i
    return all_sum / count


def  add_html_table_row(cells):
    res = "<tr>"
    for c in cells:
        res  += "  <td"
        if c["MergedColsCount"] > 1:
            res += " colspan=" + str(c["MergedColsCount"])
        res += ">"
        res += c["Text"].replace("\n", '<br/>')
        res += "</td>\n"
    return res + "</tr>\n"


def convert_to_html(jsonStr, maintag="html"):
    data = json.loads(jsonStr)
    res = "<"+ maintag +">"
    res += "<h1>" +  data['Title'] + "</h1>\n"
    res += "<table border=1>\n"
    res += "<thead>\n"
    for r in  data["Header"]:
        res += add_html_table_row(r)
    res += "</thead>\n"
    res += "<tbody>\n"
    for r in  data["Data"]:
        res += add_html_table_row(r)
    res += "</tbody>\n"
    res += "</table>"
    res += "</" + maintag + ">"
    return res;

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


def read_field(dct, field_name):
    value = dct.get(field_name)
    if value is None:
        return value
    value = str(value)
    value = value.strip("\n \r\t")
    value = value.replace(" ", "")
    value = value.replace("\n", "")
    value = value.lower()
    if value ==  u"индивидуальная":
        value = u"собственность"
    return value

def  check_equal_value(d1, d2, field_name):
    v1 = read_field(d1, field_name)
    v2 = read_field(d2, field_name)
    if v1 == v2:
        return (True, v1, v2)
    if v1 is None or v2 is None:
        return (False, v1, v2)
    try:
        f1 = float(v1.replace(",", "."))
        f2 = float(v2.replace(",", "."))
        if f1 == f2:
            return True, v1, v2
    except:
        pass
    if field_name == "own_type":
        if v1 == "индивидуальная":
            v1 = "_indiv"
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


def check_incomes_or_auto(person1, person2, field_name, check_field_name, match_info):
    v1 = get_property(person1, field_name, None)
    v2 = get_property(person2, field_name, None)
    check_field (v1, v2, field_name + "/relative=null", check_field_name, match_info)

    relative = u"Супруг(а)"
    v1 = get_property(person1, field_name, relative)
    v2 = get_property(person2, field_name, relative)
    check_field (v1, v2, field_name + "/" + relative, check_field_name, match_info)

def are_equal_realty(p1, p2):
    return ( check_equal_value(p1, p2, "text")[0] and
             check_equal_value(p1, p2, "square")[0] and
             check_equal_value(p1, p2, "relative")[0] and
            # to do check county
             check_equal_value(p1, p2, "share_amount")[0] and
             check_equal_value(p1, p2, "own_type")[0]);

def describe_realty(p):
    return u"real estate {0} square {1}".format(p.get("text"), p.get("square"))

def check_realties(realties1, realties2, match_info):
    used = set()
    for p1 in realties1:
        found = False
        for i in range(len(realties2)):
            p2 = realties2[i]
            if i not in used and are_equal_realty(p1, p2):
                found = True
                used.add( i )
                match_info.true_positive.append (describe_realty(p1))
                break
        if not found:
            match_info.false_negative.append(describe_realty(p1))
    for i in range(len(realties2)):
        if i not in used:
            match_info.false_positive.append(describe_realty(realties2[i]))


def calc_decl_match_one_pair(json1, json2):
    match_info = TMatchInfo()
    if len(json1['persons']) == 0 and len(json2['persons']) == 0:
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
    check_incomes_or_auto(person1, person2, "incomes", "size", match_info)
    check_incomes_or_auto(person1, person2, "vehicles", "text", match_info)
    check_realties(person1.get('real_estates', []), person2.get('real_estates', []), match_info)
    tp = len(match_info.true_positive)
    fp = len(match_info.false_positive)
    fn = len(match_info.false_negative)
    prec = tp /  (tp + fp + 0.0000001)
    recall = tp / (tp + fn + 0.0000001)
    match_info.f_score = 2 * prec * recall / (prec + recall)
    return match_info

def dump_conflict (task, match_info, conflict_file):
    global DATA_FOLDER
    input_id = task['INPUT:input_id']
    res = "<div>\n"
    res += "<table border=1> <tr>\n"

    res += "<tr>"
    res += "<td colspan=3><h1>"
    res += "f-score={}".format(match_info.f_score)
    res += " worker_id={}".format(task['ASSIGNMENT:worker_id'])
    res += " input_id={}".format(task['INPUT:input_id'])
    res += " line_no={}".format(task['input_line_no'])
    res += "</h1>"
    res += "</td></tr>"

    res += "<td width=30%>\n"

    input_json = task["INPUT:input_json"]
    res += convert_to_html(input_json, "div")
    res += "</td>\n"

    res += "<td width=30%>"
    res += "<textarea cols=80 rows=90>"
    res += json.dumps(json.loads(task["OUTPUT:declaration_json"]), indent=4, ensure_ascii=False)
    res += "</textarea>"
    res += "</td>\n"

    res += "<td>"
    res += "<textarea cols=80 rows=90>"
    with open (smart_parser_result_json_file(input_id), "r", encoding="utf8") as f:
        res += f.read()
    res += "</textarea>"
    res += "</td>\n"
    res += "</tr><tr>\n"
    res  += "<td colspan=3>"
    res += "<h1>"
    res += "f-score={}".format(match_info.f_score) + "<br/"
    res += "<br/>".join(match_info.dump_errors())
    res += "</h1>"
    res += "\n</tr></table>"
    res  += "</td>"
    conflict_file.write(res)


class TTolokaStats:
    def __init__(self, verbose):
        self.tasks = defaultdict(list) # tasks wo golden
        self.verbose = verbose
        self.golden_task_assignments = 0
        self.decl_match = {}
        self.errors = []

    def collect_stats(self, filename):
        line_no = 2
        with open (filename, "r", encoding="utf8") as tsv:
            for task in csv.DictReader(tsv, delimiter="\t", quotechar='"'):
                task_id = task['INPUT:input_id']
                task['input_line_no'] = line_no
                if task["GOLDEN:declaration_json"] == "":
                    self.tasks[task_id].append (task)
                else:
                    self.golden_task_assignments += 1
                line_no += 1

    def calc_decl_match(self, input_id, conflict_file):
        json_file = smart_parser_result_json_file(input_id)
        if not os.path.exists(json_file):
            self.decl_match[input_id] = 0  #smart parser failed
            return
        automatic_json = json.load(open(json_file, encoding="utf8"))
        decl_matches = []

        for x in self.tasks[input_id]:
            toloker_json = json.loads(x['OUTPUT:declaration_json'])
            match_info = calc_decl_match_one_pair(toloker_json, automatic_json)
            decl_matches.append(match_info.f_score)
            match_info.dump(input_id, x['ASSIGNMENT:worker_id'], self.errors)
            if conflict_file:
                dump_conflict(x, match_info, conflict_file)
        self.decl_match[input_id] = avg(decl_matches)

    def process(self, args):
        if args.smart_parser is None:
            raise Exception("specify --smart-parser argument")
        self.automatic_jsons = {}
        global DATA_FOLDER
        if os.path.exists(DATA_FOLDER):
            shutil.rmtree(DATA_FOLDER)
        os.mkdir(DATA_FOLDER)
        for input_id, input_tasks in self.tasks.items():
            input_json = input_tasks[0]["INPUT:input_json"]
            filename = input_html_file_name(input_id)
            with open(filename, "w", encoding="utf8") as output_html:
                html = convert_to_html(input_json)
                output_html.write(html)

        smart_parser = os.path.abspath(args.smart_parser)
        cmd = "{} -skip-relative-orphan -v debug  -adapter prod {} > log ".format(smart_parser, DATA_FOLDER);
        print (cmd)
        os.system(cmd)

        if args.dump_conflicts:
            conflict_file = open(args.dump_conflicts, "w", encoding="utf8")
        else:
            conflict_file = None

        for input_id, input_tasks in self.tasks.items():
            try:
                self.calc_decl_match(input_id, conflict_file)
            except:
                print ("cannot process {}".format(input_id))
                raise

        if args.dump_conflicts:
            conflict_file.close()


    def report(self):
        return {
            "Uniq not golden tasks": len(self.tasks),
            "Average overlap": avg (list(len(t) for t in self.tasks.values())),
            "Found assignments without golden": sum (list(len(t) for t in self.tasks.values())),
            "Average decl_match": avg (t for t in self.decl_match.values())
        }


if __name__ == '__main__':
    args = parse_args()
    toloka_stats = TTolokaStats(args.toloka)
    toloka_stats.collect_stats (args.toloka)
    toloka_stats.process(args)
    metrics = toloka_stats.report()
    print(json.dumps(metrics, indent=2))

    with open("errors.txt", "w") as outf:
        for e in toloka_stats.errors:
            outf.write(e + "\n")

