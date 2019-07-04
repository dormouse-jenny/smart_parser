// ===== start of toloka part =======

function print_to_log(str) {
    document.getElementById("debug_console").value = document.getElementById("debug_console").value + "\n" + str;
}

function throw_and_log(error) {
    print_to_log("Ошибка! " + error);
    alert(error);
    throw error;
}

function find_object_by_all_members(objList, obj) {
    for (let i = 0; i < objList.length; i++) {
        if (JSON.stringify(obj) == JSON.stringify(objList[i])) return true;
    }
    return false;
}

function find_object_by_relative(objList, relative) {
    for (let i = 0; i < objList.length; i++) {
        if (relative == objList[i].relative) return true;
    }
    return false;
}

document.last_range_from_table = null;
document.last_anchor_node_from_table = null;
document.last_focus_node_from_table = null;

function normalize_string(s) {
    s = s.replace(/\s+/g, ' ');
    s = s.trim();
    return s;
}

function get_selection_from_table() {
    let selection = window.getSelection();
    if (selection == null) return "";
    if  (selection.rangeCount == 0) return "";
    document.last_range_from_table = selection.getRangeAt(0);
    document.last_anchor_node_from_table = selection.anchorNode;
    document.last_focus_node_from_table = selection.focusNode;
    return  normalize_string(selection.toString());
}

function add_html_table_row(inputList, table) {
    let row = table.insertRow();
    for (let k = 0; k < inputList.length; ++k) {
        let cell = row.insertCell();
        let text = inputList[k].t;
        text = text.replace(/\n/g, "<br/>");
        cell.innerHTML = text;
        cell.colSpan = inputList[k].mc;
    }
}

function input_json_to_html_table(jsonStr) {
    if (typeof window.getSelection == "undefined") {
        alert ("К сожалению, ваш браузер не поддерживается!")
        return;
    }
    let data;
    try {
        data = JSON.parse(jsonStr);
    } catch (err) {
        alert ("Не могу распарсить входной json. Программисты накосячили! Напишите нам об этом. " + err);
        throw err;
    }
    let res = '<span class="input_title">' + data.Title + "</span>";
    let tbl = document.createElement("table");
    tbl.className = "input_table";
    let thead = document.createElement("thead");
    for (let i = 0; i < data.Header.length; ++i) {
        add_html_table_row(data.Header[i], thead);
    }
    if (data.Section != null) {
        for (let i = 0; i < data.Section.length; ++i) {
            add_html_table_row(data.Section[i], thead);
        }
    }
    tbl.appendChild(thead);
    let tbody = document.createElement("tbody");
    tbody.setAttribute("id", "input_table_data")
    for (let i = 0; i < data.Data.length; ++i) {
        add_html_table_row(data.Data[i], tbody);
    }
    let lastRow = tbody.insertRow();
    let cell = lastRow.insertCell();
    cell.innerHTML = "конец таблицы";

    tbl.appendChild(tbody);
    res += tbl.outerHTML;
    return res;
}

Handlebars.registerHelper('convert_json_to_html_helper', function(jsonStr) {
    return input_json_to_html_table(jsonStr);
});


Handlebars.registerHelper('owner_types', function(radio_button_name, image_div_name ) {
    let ownerTypeTemplate =  "<label> <input type=\"radio\" name={{name}}  class=\"ownertype_class\" value=\"{{value}}\" " +
        "                           onclick=\"window.show_icon('{{image}}', '{{image_div_name}}')\"\n" +
        "                           {{#if checked}} checked {{/if}}\" />{{{title}}}</label> <br/><br/>";
    let ownerTypes = [
        {'value': "", title:"Д<u>е</u>кларант", image:"http://aot.ru/images/declarator/declarant.png", "checked":"checked"},
        {'value': "Супруг(а)", title:"<u>С</u>упруг(а)", image:"http://aot.ru/images/declarator/spouse.png"},
        {'value': "Ребенок", title:"Ре<u>б</u>енок", image:"http://aot.ru/images/declarator/child.png"}
    ];
    let template = Handlebars.compile(ownerTypeTemplate);
    let html = "";
    for (let i=0; i < ownerTypes.length; i++) {
        let context = ownerTypes[i];
        context['name'] = radio_button_name;
        context['image_div_name'] = image_div_name;
        html += template(context);
    }
    return html;
});

function is_copied_span(elem) {
    return elem.nodeType == Node.ELEMENT_NODE && elem.className == 'copied_text';
}

function html_to_text_plain(element) {
    if (element.nodeType == Node.TEXT_NODE) {
        return element.textContent;
    }
    if (element.nodeType == Node.ELEMENT_NODE && element.tagName == "BR") {
        return "\n";
    }
    // assert false
    return element.textContent;
}

function html_to_text_plain_or_span(element) {
    if (!is_copied_span(element)) {
        return html_to_text_plain(element);
    }
    let text = "";
    for (let i = 0; i < element.childNodes.length; i++) {
        text += html_to_text_plain(element.childNodes[i]);
    }
    return text;
}


function get_striked_situation(tdElement) {
    let spans = [];
    let text = "";
    for (let i = 0; i < tdElement.childNodes.length; i++) {
         let child = tdElement.childNodes[i];
         let child_text = html_to_text_plain_or_span(child);
         let copied = is_copied_span(child);
         for (let k=0; k < child_text.length; k++)  {
             spans.push(copied);
         }
         text += child_text;
     }
     return {"spans": spans, "text": text}
}

//  copies Range.toString  but convert <br> to \n
function getSelectionCharacterOffsetWithin(tdElement, range) {
    let text = "";
    let begin = -1;
    let end = -1;
    for (let i = 0; i < tdElement.childNodes.length; i++) {
        let child = tdElement.childNodes[i];
        if (child  == range.startContainer) {
            begin = text.length + range.startOffset;
        }
        if (child  == range.endContainer) {
            end = text.length + range.endOffset;
        }
        if (tdElement  == range.startContainer && i == range.startOffset ) {
            begin = text.length;
        }
        if (tdElement  == range.endContainer && i == range.endOffset) {
            end = text.length;
        }
        text += html_to_text_plain_or_span(child);
    }
    if (begin == -1) {
        begin = 0;
    }
    if (end == -1) {
        end = text.length;
    }
    return { start: begin, end: end };
}


function strike_range_in_span_array(tdElement, range, strike_spans) {
    let r = getSelectionCharacterOffsetWithin (tdElement, range);
    for (let i = r.start; i  < r.end;i++ ) {
        strike_spans[i] = true;
    }
}


function strike_range_outside_table(range) {
    let strikeDiv = document.createElement('span');
    strikeDiv.style.textDecoration = "line-through";
    strikeDiv.className = "copied_text";
    try {
        range.surroundContents(strikeDiv);
    }catch (err) {
    }
}

function copy_char(text, i, outputText) {
    if (text[i] == "\n") {
        outputText += "<br/>";
    }
    else {
        outputText += text[i];
    }
    return outputText;
}

function strike_spans(tdElement, strike_situation) {
    let i = 0;
    let text = strike_situation.text;
    let spans = strike_situation.spans;
    let outputHtml = "";
    while (i <  spans.length) {
        if (spans[i] == false) {
            outputHtml =  copy_char(text, i, outputHtml)
            i++;
        }
        else {
            outputHtml += "<span class='copied_text' style='text-decoration: line-through'>";
            while (i <  spans.length && spans[i]) {
                outputHtml =  copy_char(text, i, outputHtml)
                i++;
            }
            outputHtml += "</span>";
        }
    }
    tdElement.innerHTML = outputHtml;
}

function strike_selection() {
    let range = document.last_range_from_table;
    if (range ==  null) return;
    let parent = document.last_anchor_node_from_table;
    let tdElement  = null;
    while (parent != null) {
        if (parent.tagName == "TD") {
            tdElement = parent;
        }
        if (parent.id == "input_table_data") {
            break;
        }
        parent = parent.parentNode;
    }
    if  (parent == null || tdElement == null) {
        strike_range_outside_table(range);
    } else {
        let situation = get_striked_situation(tdElement);
        strike_range_in_span_array(tdElement, range, situation.spans);
        strike_spans(tdElement, situation);
    }
}

function get_declaration_json_elem() {
    return document.getElementsByName("declaration_json")[0];
}

function moveCursorToEnd(el) {
    el.scrollTop = el.scrollHeight;
}

function read_main_json() {
    try {
        let json_elem = get_declaration_json_elem();
        let json_str =  json_elem.value;
        let res = JSON.parse(json_str);
        return res;
    } catch (err) {
        throw_and_log (err)
    }
}

document.json_versions = [];
document.table_versions = [];

function get_main_input_table () {
    return document.getElementsByClassName("input_table")[0];
}

function save_undo_version(){
    let json_elem = get_declaration_json_elem();
    let json_text = json_elem.value;
    if (json_text == null) json_text =  "";
    if (document.json_versions.length > 0 && document.json_versions[document.json_versions.length - 1] == json_text) {
        return;
    }
    document.json_versions.push(json_text);
    let mainInputTable = get_main_input_table();
    document.table_versions.push(mainInputTable.innerHTML);
}


function write_main_json(djs, strikeSelection=true) {
    let json_elem = get_declaration_json_elem();
    save_undo_version();
    json_elem.value = JSON.stringify(djs, "", 4);
    moveCursorToEnd(json_elem);
    if (strikeSelection) {
        strike_selection();
    }
}

function undo() {
    if (document.json_versions.length == 0) {
        return;
    }
    let json_text = document.json_versions.pop();
    get_declaration_json_elem().value = json_text;
    get_main_input_table().innerHTML = document.table_versions.pop();

}
window.undo = undo;


function get_new_value(message){
    let text = get_selection_from_table();
    if (text == "") {
        text =  window.prompt(message);
    }
    if (text == null) {
        text = "";
    }
    return normalize_string(text)
}

function get_radio_button_value (name) {
    let rad = document.getElementsByName(name);
    for (let i=0; i < rad.length; i++) {
        if (rad[i].checked) {
            return rad[i].value == "" ? null : rad[i].value;
        }
    }
    return null;
}

function get_radio_button_values(name) {
    let rad = document.getElementsByName(name);
    let values = []
    for (let i=0; i < rad.length; i++) {
        if (rad[i].value) {
            values.push( rad[i].value == "" ? null : rad[i].value );
        }
    }
    return values;
}

function delete_table_rows_before(tbody, rowIndex) {
    for (let r=0; r < rowIndex; r++) {
        tbody.deleteRow(0);
    }
}

function delete_table_rows_after(tbody, rowIndex) {
    let rowsCount = tbody.rows.length;
    for (let r=rowIndex; r < rowsCount; r++) {
        tbody.deleteRow(rowIndex);
    }
}

function get_selected_row(selected_node, error_message=null) {
    let cell = selected_node;
    if (cell.tagName != "TD") {
        cell = cell.parentNode;
        if (cell.tagName != "TD") {
            if (error_message != null) throw_and_log(error_message);
            return null;
        }
    }
    return cell.parentNode;
}
function get_selected_row_index() {
    let row = get_selected_row(document.last_anchor_node_from_table);
    if (row == null) return -1;
    return row.rowIndex;
}

window.current_modal_dlg = null;
function show_modal_dialog(elementId) {
    let modalDlg = document.getElementById(elementId);
    let okButton = modalDlg.getElementsByClassName("ok_button")[0];
    let cancelButton = modalDlg.getElementsByClassName("cancel_button")[0];
    let mainInputField = modalDlg.getElementsByClassName("main_input_text_field")[0];
    let text = get_selection_from_table();
    if (text !=  "") {
        mainInputField.value = text;
    }
    get_declaration_json_elem().style.display = 'none';
    modalDlg.style.display = 'block';
    okButton.focus();
    document.onkeydown = function(e) {
        if (e.key === "Escape") {cancelButton.onclick(null);}
        if (e.key === "Enter") {okButton.onclick(null);};
    };
    window.current_modal_dlg = modalDlg;
}

function close_modal_dialog(elementId) {
    get_declaration_json_elem().style.display = 'inline';
    window.current_modal_dlg = null;
    let elem = document.getElementById(elementId);
    if (elem.style.display == "none") {
        // уже закрыто
        return false;
    }
    else {
        elem.style.display = 'none';
        document.onkeydown = null;
        return true;
    }
}


function get_last_person(djson) {
    if (djson.persons.length == 0) {
        throw_and_log ( new Error("Не нашли ни одного декларанта в выходном json ( persons )"));
    }
    let person = djson.persons[djson.persons.length - 1];
    if ( !('person' in person) ) {
        throw_and_log ( new Error("У декларанта нет ФИО (нет зоны person c полем 'name_raw')"));
    };
    if ( !('name_raw' in person.person) ) {
        throw_and_log ( new Error("У декларанта нет ФИО (поле 'name_raw')"));
    };
    return person;
}

function starts_with_a_digit(s) {
    return ('0123456789'.indexOf(s[0]) != -1 );
}

//================================= BUTTONS ======================================


function check_has_name() {
    if (get_declaration_json_elem().value.trim() == "") {
        throw_and_log("Сначала нужно найти начало декларации (кнопка 'ФИО' или 'Отдел')");
    }
}

function check_cut_after() {
    let djson = read_main_json();
    let person = get_last_person(djson);

    if (!('cut_after' in person)) {
        throw_and_log("Cначала найдите начало следующего декларанта, выделите и нажмите кнопку 'Обрезать'. " +
            "Если не видите  начала следующего, обрезайте по строке, в которой написано 'конец таблицы'");
    }
}

function cut_by_selection(cutAfter) {
    let selection = window.getSelection();
    if (selection.rangeCount == 0) return;
    let startNode = selection.getRangeAt(0).startContainer;
    let start_row = get_selected_row (startNode, "Не выделена ячейка таблицы");
    let tbody = start_row.parentNode;
    let table = tbody.parentNode;
    let headerSize = table.tHead.rows.length;
    // modify table after save_undo_version
    if (cutAfter) {
        let djson = read_main_json();
        djson.persons[0].cut_after = 1;
        write_main_json(djson, false);
        delete_table_rows_after(tbody, start_row.rowIndex  - headerSize);
    } else {
        delete_table_rows_before(tbody, start_row.rowIndex - headerSize);
    }
}

function set_declarant_end  () {
    check_has_name();
    cut_by_selection(true);
}
window.set_declarant_end = set_declarant_end;

function create_or_read_json () {
    if (get_declaration_json_elem().value.trim().length > 0) {
        return read_main_json();
    } else {
        return {
            persons: [{}],
            document: {},
        }
    }
}

function check_valid_fio (text) {
    if (text.length > 50) {
        throw_and_log("ФИО слишком длинное (>50 символов)");
    }
    if (text.indexOf(" ") == -1 && text.indexOf(".") == -1) {
        throw_and_log("Однословных ФИО не бывает");
    }
    if (starts_with_a_digit(text)) {
        throw_and_log("Недопустимый ФИО (начинатся с числа)");
    }

    let items = text.split(/[ \.]+/);
    if (items.length < 3 ||  items.length > 4) {
        if (text.match(/\s[А-Я]\./) == null)  { // БУРОВ А.Г.Х.
            if (text.match(/\s*[А-Я][А-Яа-я]+\s+[А-Я][А-Я]\s*/) == null) {        // Буров АЯ
                throw_and_log("Недопустимый ФИО (волшебная регулярка)");
            }
        }
    }
}


function add_declarant() {
    let text = get_new_value("Введите ФИО");
    if (text.length == 0) return;
    check_valid_fio(text);
    let djson = create_or_read_json();
    let  cutBefore = false;
    if (!('person' in djson.persons[0])) {
        cutBefore = true;
        djson.persons[0].person  = {}
    }
    djson.persons[0].person.name_raw = text;
    write_main_json(djson);
    if (cutBefore) cut_by_selection(false);
}
window.add_declarant = add_declarant;


function add_declarant_role() {
    check_cut_after();
    let djson = read_main_json();
    let person = get_last_person(djson);
    let text = get_new_value("Введите роль (должность):");
    if (text == "") return;
    if (starts_with_a_digit(text)) {
        throw_and_log("плохой тип недвижимости: " + text);
    }
    person.person.role = text;
    write_main_json(djson);
}
window.add_declarant_role = add_declarant_role;

function add_realties_number() {
    check_cut_after();
    let djson = read_main_json();
    let person = get_last_person(djson);
    let text =  window.prompt("Введите количество объектов недвижимости:");
    if (text != "") {
        let n = Math.floor(Number(text));
        if (n == null || n == Infinity || Number.isNaN(n)) {
            throw_and_log("не могу прочитать число!")
        }
        person.real_estates_count = n;
        write_main_json(djson);
    }
}
window.add_realties_number = add_realties_number;


function isNormalYear(str) {
    let n = Math.floor(Number(str));
    if (n==-1) {
        return true;
    }
    return n !== Infinity && String(n) === str && n >= 2000 && n < 2030;
}

function add_year() {
    check_cut_after();
    let djson = read_main_json();
    let person = get_last_person(djson);
    let text = get_new_value("Введите год");
    if (text != "") {
        if (!isNormalYear(text)) {
            throw_and_log ("Год - это число между 2000 и 2030 или -1 (не найден)")
        }
        person.year = text;
        write_main_json(djson);
    }
}
window.add_year = add_year;



function close_realty_modal_box(save_results=true){
    if (!close_modal_dialog('RealtyTypeDialog')) {
        return;
    }
    if (save_results) {
        let djson = read_main_json();
        let person = get_last_person(djson);
        if (!("real_estates" in person)) {
            person.real_estates = [];
        }
        let type_raw = normalize_string( document.getElementById('realty_type').value );
        if (type_raw.length == 0) return;
        if (starts_with_a_digit(type_raw)) {
            throw_and_log("плохой тип недвижимости: " + type_raw);
        }
        let real_estate = {
            'type_raw': type_raw,
            "own_type_by_column":   get_radio_button_value ('realty_own_type_by_column'),
            "relative":   get_radio_button_value ( 'realty_owner_type'),
            "country_raw": 'Россия',
            "source_row": get_selected_row_index()
        };
        person.real_estates.push(real_estate)
        write_main_json(djson);
    }
}
window.close_realty_modal_box = close_realty_modal_box;


function add_realty() {
    let djson = read_main_json();
    let person = get_last_person(djson);
    if (!('real_estates_count' in person)) {
        throw_and_log("Сначала посчитайте кол-во объектов недвижимости и нажмите кнопку 'Кол-во', чтобы ничего не забыть")
    }
    show_modal_dialog('RealtyTypeDialog');
}
window.add_realty = add_realty;

function check_has_real_estate() {
    let djson = read_main_json();
    let person = get_last_person(djson);
    if (!('real_estates' in person)) {
        throw_and_log ( new Error("У декларанта нет ни одной записи о недвижимости (поле 'real_estates')"));
    }
}

function add_square() {
    check_has_real_estate();
    let djson = read_main_json();
    let person = get_last_person(djson);
    let text = get_new_value("Введите площадь:");
    if (text == "") return;
    if (!starts_with_a_digit(text)) {
        throw_and_log("Площадь должна начинаться с числа")
    }
    person.real_estates[person.real_estates.length - 1]['square_raw'] = text;
    write_main_json(djson);
}
window.add_square = add_square;

function add_own_type() {
    check_has_real_estate();
    let djson = read_main_json();
    let person = get_last_person(djson);
    let text = get_new_value("Введите вид владения:");
    if (text == "") return;
    if (starts_with_a_digit(text)) {
        throw_and_log("Недопустимый подтип владения (начинается с числа)")
    }
    if (text.toLowerCase().match(/^((0об[щш])|(дол)|(зем)|(инд)|(со[бв])|(най))/) == null){
        throw_and_log("Недопустимый подтип владения (волшебная регулярка)с")
    }
    person.real_estates[person.real_estates.length - 1]['own_type_raw'] = text;
    write_main_json(djson);
}
window.add_own_type = add_own_type;


function add_country() {
    check_has_real_estate();
    let djson = read_main_json();
    let person = get_last_person(djson);
    let text = get_new_value("Введите страну:");
    if (text == "") return;
    if (starts_with_a_digit(text)) {
        throw_and_log("Недопустимое название страны")
    }
    let lower_t = text.toLowerCase();
    if  (lower_t == "российская федерация" || lower_t == "рф" || lower_t == "россия")  {
        text = "Россия";
        alert("страна и так по умолчанию - Россия, не нажимайте эту кнопку, если недвижимость в РФ");
    }
    person.real_estates[person.real_estates.length - 1]["country_raw"] = text;
    write_main_json(djson);
}
window.add_country = add_country;


function close_income_modal_box(save_results=true){
    close_modal_dialog('IncomeDialog');
    if (save_results) {
        let djson = read_main_json();
        let person = get_last_person(djson);
        if (!("incomes" in person)) {
            person.incomes = [];
        }
        let income_str = normalize_string(document.getElementById('income_value').value);
        if (income_str == "") return;
        if (!starts_with_a_digit(income_str)) {
            throw_and_log("Недопустимое значение дохода")
        }
        let relative = get_radio_button_value ('income_owner_type')
        if (relative != null && income_str[0] == '0') {
            throw_and_log( "Почему вы не читали инструкцию? Нулевой доход у родственников заполнять не надо")
        }
        let income  = {
            'size_raw': income_str,
            "source_row": get_selected_row_index(),
            "relative":   get_radio_button_value ('income_owner_type')
        };
        if  (find_object_by_all_members(person.incomes, income)) {
            throw_and_log("Попытка повторно добаавить ту же информацию")
        }
        if (find_object_by_relative(person.incomes, income.relative)) {
            throw_and_log("Попытка повторно приписать доход одной и той же персоне")
        }
        person.incomes.push(income)
        write_main_json(djson);
    }
}
window.close_income_modal_box = close_income_modal_box;

function add_income() {
    show_modal_dialog('IncomeDialog');
}
window.add_income = add_income;


function close_vehicle_modal_box(save_results=true){
    close_modal_dialog('VehicleDialog');
    if (save_results) {
        let djson = read_main_json();
        let person = get_last_person(djson);
        if (!("vehicles" in person)) {
            person.vehicles = [];
        }
        let vehicle_str = normalize_string(document.getElementById('vehicle_value').value);
        if (vehicle_str.length == 0) return;
        let vehicle  = {
            'text': vehicle_str,
            "source_row": get_selected_row_index(),
            "relative":   get_radio_button_value ('vehicle_owner_type')
        };
        if  (find_object_by_all_members(person.vehicles, vehicle)) {
            throw_and_log("Попытка повторно добаавить ту же информацию")
        }
        person.vehicles.push(vehicle)
        write_main_json(djson);
    }
}
window.close_vehicle_modal_box = close_vehicle_modal_box;

function add_vehicle() {
    check_cut_after();
    show_modal_dialog('VehicleDialog');
}
window.add_vehicle = add_vehicle;

function check_relative(field) {
    if (typeof field == "undefined") return;
    let values = get_radio_button_values('vehicle_owner_type')
    for (let i = 0; i < field.length; i++) {
        if  ( (field[i].relative != null)  && (values.indexOf(field[i].relative) == -1)){
            throw_and_log("bad relative in " + JSON.stringify(field[i], ""));
        };
    }
}


function check_source_row_to_relative_one_field(field, source_row_2_relative) {

    if (field == null) return;

    for (let i = 0; i < field.length; i++) {
        let r = field[i];
        if ('source_row' in r && r.source_row != -1) {
            if (r.source_row in source_row_2_relative) {
                if (r.relative != source_row_2_relative[r.source_row]) {
                    throw_and_log("Из одной и той же строки (" + r.source_row +
                        ") вы приписали информацию разным персонам (родственникам или декларантам, поле relative). Кажется, так не бывает." +
                        " Если случилось, пришлите нам пример, а это задание пропустите. В одной строке входной таблицы у всех поле relative должен быть одинаковым");
                }
            }
            source_row_2_relative[r.source_row] = r.relative;
        }
        if ('source_row' in r) delete r.source_row;
    }
}

function check_source_row_to_relative(person) {
    let source_row_2_relative = {};
    check_source_row_to_relative_one_field(person.real_estates, source_row_2_relative);
    check_source_row_to_relative_one_field(person.incomes, source_row_2_relative);
    check_source_row_to_relative_one_field(person.vehicles, source_row_2_relative);
}

function check_real_estate_records(person) {
    check_real_estates_count(person);

    if (typeof person.real_estates == "undefined") return;

    let values = get_radio_button_values('realty_own_type_by_column')
    let has_own_type_raw = false;
    let own_type_by_columns = new Set();
    for (let i = 0; i < person.real_estates.length; i++) {
        let r = person.real_estates[i];
        if  ( r.own_type_by_column != null && values.indexOf(r.own_type_by_column) == -1) {
            let s =  "Неправильный own_type_by_column: ";
            s += r.own_type_by_column;
            s +=  "\n\n" + JSON.stringify(r, "");
            throw_and_log(s);
        };
        if (!('square_raw'  in r)) {
            let s = "нет площади у недвижимости:\n";
            s += JSON.stringify(r, "");
            s += "\n\nПоставьте \"square_raw\": -1, если ее реально нет во входной таблице";
            throw_and_log(s);
        }

        if (r.own_type_raw != null) {
            if (r.own_type_by_column == "В собственности") {
                has_own_type_raw = true;
            }
        }
        own_type_by_columns.add(r.own_type_by_column);
    }
    if  (own_type_by_columns.has(null) && own_type_by_columns.size != 1) {
        throw_and_log("Если есть смешанная колонка недвижимости, то других нет");
    }

    for (let i = 0; i < person.real_estates.length; i++) {
        let r = person.real_estates[i];
        if (has_own_type_raw  && r.own_type_by_column == "В собственности" && r.own_type_raw == null) {
            throw_and_log("В одном из объектов недвижимости, котораый в собственности, вы приписали подтип владения ("
                + r.own_type_raw + "), а в другом не приписали. Либо есть эта колонка, либо нет.");
        }
        if (r.own_type_by_column == "В пользовании" && r.own_type_raw != null) {
            throw_and_log("Мы сами не видели декларация, где указаны подтип владения государственных квартир. Если вы нашли, пожалуйста, "
                + " пришлите нам пример задания, а это задания пропустите.");
        }
    }
}

function create_text_for_real_estate_type(person) {
    if (typeof person.real_estates == "undefined") return;
    for (let i = 0; i < person.real_estates.length; i++) {
        let r = person.real_estates[i];
        if ('text' in r) continue; // already converted
        if (!('own_type_raw' in r)) {
            if (!('type_raw' in r)) {
                throw_and_log("cannot find 'type_raw' in " + JSON.stringify(r, ""));
            }
            r.text = r.type_raw;
            delete r.type_raw;
        } else {
            r.text = r.type_raw;
        }
    }
}


function check_real_estates_count(person) {
    if (!('real_estates_count' in person)) {
        throw_and_log("Не найдено поле real_estates_count (нажмите кнопку 'Кол-во')");
    }
    if (person.real_estates_count == 0 && !('real_estates' in person)) {
        return;
    }
    if (person.real_estates_count != person.real_estates.length) {
        throw_and_log("Поле real_estates_count (кнопка 'Кол-во') не равно числу добавленных объектов недвижимости")
    }
}

function sort_json_by_keys(o) {
    const isObject = (v) => ('[object Object]' === Object.prototype.toString.call(v));

    if (Array.isArray(o)) {
        return o.sort().map(v => isObject(v) ? sort_json_by_keys(v) : v);
    } else if (isObject(o)) {
        return Object
            .keys(o)
            .sort()
            .reduce((a, k) => {
                if (isObject(o[k])) {
                    a[k] = sort_json_by_keys(o[k]);
                } else if (Array.isArray(o[k])) {
                    a[k] = o[k].map(v => isObject(v) ? sort_json_by_keys(v) : v);
                } else {
                    a[k] = o[k];
                }

                return a;
            }, {});
    }

    return o;
}

function compare_string(a,b) {
    if (a == null) a = "";
    if (b == null) b = "";
    return  a.localeCompare(b);
}

function sort_declaration_json(person) {
    if ('incomes' in person) {
        person.incomes.sort(function(a, b) {
            return compare_string(a['size_raw'], b['size_raw']);
        })
    }
    if ('real_estates' in person) {
        person.real_estates.sort(function(a, b) {
            if  (a['relative'] !=  b['relative']) return compare_string(a['relative'], b['relative']);
            if  (a['own_type_by_column'] !=  b['own_type_by_column']) return compare_string(a['own_type_by_column'], b['own_type_by_column']);
            if  (a['square_raw'] !=  b['square_raw']) return compare_string(a['square_raw'], b['square_raw']);
            return compare_string(a['text'], b['text']);
        })
    }
    if ('vehicles' in person) {
        person.vehicles.sort(function(a, b) {
            if  (a['relative'] !=  b['relative']) return compare_string(a['relative'], b['relative']);
            return compare_string(a['text'], b['text']);
        })
    }
    return sort_json_by_keys(person);
}

function find_unstriked_text(elem) {
    for (let i = 0; i < elem.childNodes.length; i++) {
        let child = elem.childNodes[i];
        if (is_copied_span(child)) continue;
        let trim_text  = child.textContent.replace(/\s+/g, "");
        if (trim_text != "") return trim_text;
    }
    return '';
}

function check_table_strike_text() {
    let tbody = document.getElementById("input_table_data");
    for (let r=0; r < tbody.rows.length; r++) {
        for (let c=0; c < tbody.rows[r].cells.length; c++) {
            let cell = tbody.rows[r].cells[c];
            let html = cell.innerHTML;
            if (html != null  &&  html.indexOf("copied_text") != -1) {
                let left_text = find_unstriked_text(cell);
                if (left_text != "") {
                    throw_and_log("В ячейке есть зачеркнутый и незачеркнутый текст, наверно, вы забыли перенести: " +
                        '"'+ left_text+ '". Содержимое ячейки: \n' +  cell.textContent);
                }
            }
        }
    }

}

function check_mandatory_fields(successMessage=true) {
    check_has_name();

    let djson = read_main_json();
    if (djson.persons_empty == 1) {
        if (successMessage)  alert("Успех!")
        return;
    }
    check_table_strike_text();

    let person = get_last_person(djson);
    if (!('incomes' in person) || person.incomes.length == 0) {
        throw_and_log("Не найдено поле дохода (поле incomes)")
    }
    if (!('year' in person) ) {
        throw_and_log("Не найдено поле года (year)")
    }
    check_relative(person.real_estates);
    check_relative(person.vehicles);
    check_relative(person.incomes);
    create_text_for_real_estate_type(person);
    check_real_estate_records(person);
    check_source_row_to_relative(person);
    djson.persons[0] = sort_declaration_json(person);
    write_main_json(djson, false);
    if (successMessage)  alert("Успех!")
}
window.check_mandatory_fields = check_mandatory_fields;

function  switch_radio_in_modal(modalDlg, className, radioBtnValue) {
    if (modalDlg == null) return;
    let inputs = modalDlg.getElementsByClassName(className);
    for (let i =0; i < inputs.length; i++) {
            if (inputs[i].value == radioBtnValue)  {
                inputs[i].checked = true;
                inputs[i].onclick(null);
            }

    }
}

document.onkeypress = function(e) {
    if (document.activeElement.name == "declaration_json") return;
    if (document.activeElement.tagName == "input") return;
    if ((e.key == "Н") || (e.key == "н") || (e.key == "y") || (e.key == "Y"))  {
        window.add_realty();
    }
    if ((e.key == "Ф") || (e.key == "ф") || (e.key == "A") || (e.key == "a"))  {
        window.add_declarant();
    }
    if ((e.key == "Р") || (e.key == "р") || (e.key == "H") || (e.key == "h"))  {
        window.add_declarant_role();
    }
    if ((e.key == "Д") || (e.key == "д") || (e.key == "l") || (e.key == "L"))  {
        window.add_income();
    }
    if ((e.key == "Г") || (e.key == "г") || (e.key == "U") || (e.key == "u"))  {
        window.add_year();
    }
    if ((e.key == "Т") || (e.key == "т") || (e.key == "N") || (e.key == "n"))  {
        window.add_vehicle();
    }
    if ((e.key == "П") || (e.key == "п") || (e.key == "G") || (e.key == "g")) {
        window.add_square();
    }
    if ((e.key == "О") || (e.key == "о") || (e.key == "J") || (e.key == "j")) {
        window.set_declarant_end();
    }
    if ((e.key == "Л") || (e.key == "л") || (e.key == "K") || (e.key == "k")) {
        window.add_department();
    }
    if ((e.key == "В") || (e.key == "в") || (e.key == "D") || (e.key == "d")) {
        window.add_own_type();
    }
    if ((e.key == "К") || (e.key == "к") || (e.key == "R") || (e.key == "r")) {
        window.add_realties_number();
    }
    if ((e.key == "Е") || (e.key == "е") || (e.key == "T") || (e.key == "t")) {
        switch_radio_in_modal(window.current_modal_dlg, "ownertype_class", "");
    }
    if ((e.key == "С") || (e.key == "с") || (e.key == "C") || (e.key == "c")) {
        switch_radio_in_modal(window.current_modal_dlg,"ownertype_class", "Супруг(а)");
    }
    if ((e.key == "Б") || (e.key == "б") || (e.key == ",") || (e.key == "<")) {
        switch_radio_in_modal(window.current_modal_dlg,"ownertype_class", "Ребенок");
    }

};


function show_icon(url, placeId) {
    let elem = document.getElementsByName(placeId)[0];
    elem.innerHTML = ''
    let img = document.createElement('img');
    img.src = url;
    elem.appendChild(img);
}
window.show_icon = show_icon;


function add_department() {
    let text = get_new_value("Введите отдел (организацию)");
    if (text.length == 0) return;
    if (starts_with_a_digit(text))  {
        throw_and_log("Недопустимый департамент " + text);
    }
    let djson = create_or_read_json();;
    let person = djson.persons[0]
    if (!('person' in person))  person.person = {};
    person.person.department = text;
    write_main_json(djson);
    cut_by_selection(false);
}
window.add_department = add_department;

String.prototype.hashCodeNoSpaces = function() {
    let hash = 0;
    let s = this.replace(/[\s():;,".-]/g, "")
    for (let i = 0; i < s.length; i++) {
        let chr   = s.charCodeAt(i);
        hash  = ((hash << 5) - hash) + chr;
        hash |= 0;
    }
    return hash;
};


function on_toloka_validate(solutions) {
    check_mandatory_fields(false);

    let text = get_declaration_json_elem().value;
    let djson = JSON.parse(text);
    if (!('persons_empty' in djson)) {
        if ('cut_after' in djson.persons[0]) {
            delete djson.persons[0].cut_after;
        }
    }
    let jsonStr = JSON.stringify(djson);
    let hashCode = jsonStr.hashCodeNoSpaces();
    if (solutions != null) {
        solutions.output_values["declaration_json"] = jsonStr;
        solutions.output_values["declaration_hashcode"] = hashCode;
    }
}


// ===== end of toloka part =======

Handlebars.registerHelper('field', function() {
    let elem = document.createElement('textarea');
    elem.style.width = '100%';
    elem.rows = 20;
    elem.name = 'declaration_json'
    return elem.outerHTML;
});



let taskSource = document.getElementsByClassName("main_task_table")[0];
let handleBarsTemplate = Handlebars.compile(taskSource.innerHTML);
let tsvLine = '8ac2f59bfc12c69db26afb8d5e64c900__11_31\t"{""Title"":""Сведения\\nо доходах, расходах, об имуществе и обязательствах имущественного характера работников организаций созданных для выполнения задач, поставленных перед Минтрудом России (за исключением руководителей данных организаций),\\nза отчетный период с 1 января 2015 года по 31 декабря 2015 года \\n\\n\\n"",""InputFileName"":""documents/34544.docx"",""DataStart"":11,""DataEnd"":31,""Header"":[[{""mc"":1,""mr"":2,""r"":0,""c"":0,""t"":""№\\nп/п\\n""},{""mc"":1,""mr"":2,""r"":0,""c"":1,""t"":""Фамилия и инициалы лица, чьи сведения размещаются\\n""},{""mc"":1,""mr"":2,""r"":0,""c"":2,""t"":""Должность\\n""},{""mc"":4,""mr"":1,""r"":0,""c"":3,""t"":""\\nОбъекты недвижимости, находящиеся в собственности\\n\\n""},{""mc"":3,""mr"":1,""r"":0,""c"":7,""t"":""Объекты недвижимости, находящиеся \\nв пользовании\\n""},{""mc"":1,""mr"":2,""r"":0,""c"":10,""t"":""Транспортные средства\\n(вид, марка)\\n""},{""mc"":1,""mr"":2,""r"":0,""c"":11,""t"":""Декларированный годовой доход 1 за 2015 год (руб.)\\n""},{""mc"":1,""mr"":2,""r"":0,""c"":12,""t"":""Сведения \\nоб источниках получения средств, за счет которых совершена сделка2 (вид приобретенного имущества, источники)\\n""}],[{""mc"":1,""mr"":1,""r"":1,""c"":0,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":1,""c"":1,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":1,""c"":2,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":1,""c"":3,""t"":""вид объекта\\n""},{""mc"":1,""mr"":1,""r"":1,""c"":4,""t"":""вид собственности\\n""},{""mc"":1,""mr"":1,""r"":1,""c"":5,""t"":""площадь (кв.м)\\n""},{""mc"":1,""mr"":1,""r"":1,""c"":6,""t"":""страна распо-ложения\\n""},{""mc"":1,""mr"":1,""r"":1,""c"":7,""t"":""вид объекта\\n""},{""mc"":1,""mr"":1,""r"":1,""c"":8,""t"":""площадь (кв.м)\\n""},{""mc"":1,""mr"":1,""r"":1,""c"":9,""t"":""страна распо-ложения\\n""},{""mc"":1,""mr"":1,""r"":1,""c"":10,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":1,""c"":11,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":1,""c"":12,""t"":""\\n""}]],""Section"":[[{""mc"":1,""mr"":1,""r"":2,""c"":0,""t"":""\\n""},{""mc"":12,""mr"":1,""r"":2,""c"":1,""t"":""ФКУ \\""ГБ МСЭ по Вологодской области\\"" Минтруда России\\n""}]],""Data"":[[{""mc"":1,""mr"":7,""r"":11,""c"":0,""t"":""\\n""},{""mc"":1,""mr"":7,""r"":11,""c"":1,""t"":""\\n""},{""mc"":1,""mr"":7,""r"":11,""c"":2,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":11,""c"":3,""t"":""Земельный участок\\n""},{""mc"":1,""mr"":1,""r"":11,""c"":4,""t"":""индивидуальная\\n""},{""mc"":1,""mr"":1,""r"":11,""c"":5,""t"":""600,0\\n""},{""mc"":1,""mr"":1,""r"":11,""c"":6,""t"":""Россия\\n""},{""mc"":1,""mr"":7,""r"":11,""c"":7,""t"":""\\n""},{""mc"":1,""mr"":7,""r"":11,""c"":8,""t"":""\\n""},{""mc"":1,""mr"":7,""r"":11,""c"":9,""t"":""\\n""},{""mc"":1,""mr"":7,""r"":11,""c"":10,""t"":""\\n""},{""mc"":1,""mr"":7,""r"":11,""c"":11,""t"":""\\n""},{""mc"":1,""mr"":7,""r"":11,""c"":12,""t"":""\\n""}],[{""mc"":1,""mr"":6,""r"":12,""c"":0,""t"":""\\n""},{""mc"":1,""mr"":6,""r"":12,""c"":1,""t"":""\\n""},{""mc"":1,""mr"":6,""r"":12,""c"":2,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":12,""c"":3,""t"":""Земельный участок\\n""},{""mc"":1,""mr"":1,""r"":12,""c"":4,""t"":""индивидуальная\\n""},{""mc"":1,""mr"":1,""r"":12,""c"":5,""t"":""600,0\\n""},{""mc"":1,""mr"":1,""r"":12,""c"":6,""t"":""Россия\\n""},{""mc"":1,""mr"":6,""r"":12,""c"":7,""t"":""\\n""},{""mc"":1,""mr"":6,""r"":12,""c"":8,""t"":""\\n""},{""mc"":1,""mr"":6,""r"":12,""c"":9,""t"":""\\n""},{""mc"":1,""mr"":6,""r"":12,""c"":10,""t"":""\\n""},{""mc"":1,""mr"":6,""r"":12,""c"":11,""t"":""\\n""},{""mc"":1,""mr"":6,""r"":12,""c"":12,""t"":""\\n""}],[{""mc"":1,""mr"":5,""r"":13,""c"":0,""t"":""\\n""},{""mc"":1,""mr"":5,""r"":13,""c"":1,""t"":""\\n""},{""mc"":1,""mr"":5,""r"":13,""c"":2,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":13,""c"":3,""t"":""Земельный участок\\n""},{""mc"":1,""mr"":1,""r"":13,""c"":4,""t"":""индивидуальная\\n""},{""mc"":1,""mr"":1,""r"":13,""c"":5,""t"":""655,0\\n""},{""mc"":1,""mr"":1,""r"":13,""c"":6,""t"":""Россия\\n""},{""mc"":1,""mr"":5,""r"":13,""c"":7,""t"":""\\n""},{""mc"":1,""mr"":5,""r"":13,""c"":8,""t"":""\\n""},{""mc"":1,""mr"":5,""r"":13,""c"":9,""t"":""\\n""},{""mc"":1,""mr"":5,""r"":13,""c"":10,""t"":""\\n""},{""mc"":1,""mr"":5,""r"":13,""c"":11,""t"":""\\n""},{""mc"":1,""mr"":5,""r"":13,""c"":12,""t"":""\\n""}],[{""mc"":1,""mr"":4,""r"":14,""c"":0,""t"":""\\n""},{""mc"":1,""mr"":4,""r"":14,""c"":1,""t"":""\\n""},{""mc"":1,""mr"":4,""r"":14,""c"":2,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":14,""c"":3,""t"":""Земельный участок\\n""},{""mc"":1,""mr"":1,""r"":14,""c"":4,""t"":""индивидуальная\\n""},{""mc"":1,""mr"":1,""r"":14,""c"":5,""t"":""1784,0\\n""},{""mc"":1,""mr"":1,""r"":14,""c"":6,""t"":""Россия\\n""},{""mc"":1,""mr"":4,""r"":14,""c"":7,""t"":""\\n""},{""mc"":1,""mr"":4,""r"":14,""c"":8,""t"":""\\n""},{""mc"":1,""mr"":4,""r"":14,""c"":9,""t"":""\\n""},{""mc"":1,""mr"":4,""r"":14,""c"":10,""t"":""\\n""},{""mc"":1,""mr"":4,""r"":14,""c"":11,""t"":""\\n""},{""mc"":1,""mr"":4,""r"":14,""c"":12,""t"":""\\n""}],[{""mc"":1,""mr"":3,""r"":15,""c"":0,""t"":""\\n""},{""mc"":1,""mr"":3,""r"":15,""c"":1,""t"":""\\n""},{""mc"":1,""mr"":3,""r"":15,""c"":2,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":15,""c"":3,""t"":""Земельный участок\\n""},{""mc"":1,""mr"":1,""r"":15,""c"":4,""t"":""индивидуальная\\n""},{""mc"":1,""mr"":1,""r"":15,""c"":5,""t"":""1300,0\\n""},{""mc"":1,""mr"":1,""r"":15,""c"":6,""t"":""Россия\\n""},{""mc"":1,""mr"":3,""r"":15,""c"":7,""t"":""\\n""},{""mc"":1,""mr"":3,""r"":15,""c"":8,""t"":""\\n""},{""mc"":1,""mr"":3,""r"":15,""c"":9,""t"":""\\n""},{""mc"":1,""mr"":3,""r"":15,""c"":10,""t"":""\\n""},{""mc"":1,""mr"":3,""r"":15,""c"":11,""t"":""\\n""},{""mc"":1,""mr"":3,""r"":15,""c"":12,""t"":""\\n""}],[{""mc"":1,""mr"":2,""r"":16,""c"":0,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":16,""c"":1,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":16,""c"":2,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":16,""c"":3,""t"":""Земельный участок\\n""},{""mc"":1,""mr"":1,""r"":16,""c"":4,""t"":""индивидуальная\\n""},{""mc"":1,""mr"":1,""r"":16,""c"":5,""t"":""616,0\\n""},{""mc"":1,""mr"":1,""r"":16,""c"":6,""t"":""Россия\\n""},{""mc"":1,""mr"":2,""r"":16,""c"":7,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":16,""c"":8,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":16,""c"":9,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":16,""c"":10,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":16,""c"":11,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":16,""c"":12,""t"":""\\n""}],[{""mc"":1,""mr"":1,""r"":17,""c"":0,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":17,""c"":1,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":17,""c"":2,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":17,""c"":3,""t"":""Земельный участок\\n""},{""mc"":1,""mr"":1,""r"":17,""c"":4,""t"":""индивидуальная\\n""},{""mc"":1,""mr"":1,""r"":17,""c"":5,""t"":""616,0\\n""},{""mc"":1,""mr"":1,""r"":17,""c"":6,""t"":""Россия\\n""},{""mc"":1,""mr"":1,""r"":17,""c"":7,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":17,""c"":8,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":17,""c"":9,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":17,""c"":10,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":17,""c"":11,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":17,""c"":12,""t"":""\\n""}],[{""mc"":1,""mr"":3,""r"":18,""c"":0,""t"":""\\n2\\n""},{""mc"":1,""mr"":3,""r"":18,""c"":1,""t"":""Павлова В.А.\\n""},{""mc"":1,""mr"":3,""r"":18,""c"":2,""t"":""Главный  бухгалтер\\n""},{""mc"":1,""mr"":1,""r"":18,""c"":3,""t"":""Земельный участок\\n""},{""mc"":1,""mr"":1,""r"":18,""c"":4,""t"":""индивидуальная\\n""},{""mc"":1,""mr"":1,""r"":18,""c"":5,""t"":""440,0\\n""},{""mc"":1,""mr"":1,""r"":18,""c"":6,""t"":""Россия\\n""},{""mc"":1,""mr"":3,""r"":18,""c"":7,""t"":""-\\n""},{""mc"":1,""mr"":3,""r"":18,""c"":8,""t"":""-\\n""},{""mc"":1,""mr"":3,""r"":18,""c"":9,""t"":""-\\n""},{""mc"":1,""mr"":3,""r"":18,""c"":10,""t"":""-\\n""},{""mc"":1,""mr"":3,""r"":18,""c"":11,""t"":""704 262,72\\n""},{""mc"":1,""mr"":3,""r"":18,""c"":12,""t"":""-\\n""}],[{""mc"":1,""mr"":2,""r"":19,""c"":0,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":19,""c"":1,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":19,""c"":2,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":19,""c"":3,""t"":""Квартира\\n""},{""mc"":1,""mr"":1,""r"":19,""c"":4,""t"":""индивидуальная\\n""},{""mc"":1,""mr"":1,""r"":19,""c"":5,""t"":""52,0\\n""},{""mc"":1,""mr"":1,""r"":19,""c"":6,""t"":""Россия\\n""},{""mc"":1,""mr"":2,""r"":19,""c"":7,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":19,""c"":8,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":19,""c"":9,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":19,""c"":10,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":19,""c"":11,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":19,""c"":12,""t"":""\\n""}],[{""mc"":1,""mr"":1,""r"":20,""c"":0,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":20,""c"":1,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":20,""c"":2,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":20,""c"":3,""t"":""Квартира\\n""},{""mc"":1,""mr"":1,""r"":20,""c"":4,""t"":""индивидуальная\\n""},{""mc"":1,""mr"":1,""r"":20,""c"":5,""t"":""47,0\\n""},{""mc"":1,""mr"":1,""r"":20,""c"":6,""t"":""Россия\\n""},{""mc"":1,""mr"":1,""r"":20,""c"":7,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":20,""c"":8,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":20,""c"":9,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":20,""c"":10,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":20,""c"":11,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":20,""c"":12,""t"":""\\n""}],[{""mc"":1,""mr"":5,""r"":21,""c"":0,""t"":""3\\n""},{""mc"":1,""mr"":2,""r"":21,""c"":1,""t"":""Кокореева И.А.\\n""},{""mc"":1,""mr"":2,""r"":21,""c"":2,""t"":""Заместитель руководителя по общим вопросам \\n""},{""mc"":1,""mr"":1,""r"":21,""c"":3,""t"":""Квартира\\n""},{""mc"":1,""mr"":1,""r"":21,""c"":4,""t"":""индивидуальная\\n""},{""mc"":1,""mr"":1,""r"":21,""c"":5,""t"":""64,1\\n""},{""mc"":1,""mr"":1,""r"":21,""c"":6,""t"":""Россия\\n""},{""mc"":1,""mr"":2,""r"":21,""c"":7,""t"":""-\\n""},{""mc"":1,""mr"":2,""r"":21,""c"":8,""t"":""-\\n""},{""mc"":1,""mr"":2,""r"":21,""c"":9,""t"":""-\\n""},{""mc"":1,""mr"":2,""r"":21,""c"":10,""t"":""-\\n""},{""mc"":1,""mr"":2,""r"":21,""c"":11,""t"":""719 536,60\\n""},{""mc"":1,""mr"":2,""r"":21,""c"":12,""t"":""-\\n""}],[{""mc"":1,""mr"":4,""r"":22,""c"":0,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":22,""c"":1,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":22,""c"":2,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":22,""c"":3,""t"":""Комната\\n""},{""mc"":1,""mr"":1,""r"":22,""c"":4,""t"":""индивидуальная\\n""},{""mc"":1,""mr"":1,""r"":22,""c"":5,""t"":""11,5\\n""},{""mc"":1,""mr"":1,""r"":22,""c"":6,""t"":""Россия\\n""},{""mc"":1,""mr"":1,""r"":22,""c"":7,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":22,""c"":8,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":22,""c"":9,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":22,""c"":10,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":22,""c"":11,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":22,""c"":12,""t"":""\\n""}],[{""mc"":1,""mr"":3,""r"":23,""c"":0,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":23,""c"":1,""t"":""Супруг\\n""},{""mc"":1,""mr"":2,""r"":23,""c"":2,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":23,""c"":3,""t"":""Гаражный бокс\\n""},{""mc"":1,""mr"":1,""r"":23,""c"":4,""t"":""индивидуальная\\n""},{""mc"":1,""mr"":1,""r"":23,""c"":5,""t"":""23,3\\n""},{""mc"":1,""mr"":1,""r"":23,""c"":6,""t"":""Россия\\n""},{""mc"":1,""mr"":2,""r"":23,""c"":7,""t"":""Квартира\\n""},{""mc"":1,""mr"":2,""r"":23,""c"":8,""t"":""64,1\\n""},{""mc"":1,""mr"":2,""r"":23,""c"":9,""t"":""Россия\\n""},{""mc"":1,""mr"":1,""r"":23,""c"":10,""t"":""а/м легковой\\nРено Дастер\\n""},{""mc"":1,""mr"":2,""r"":23,""c"":11,""t"":""167 643,38\\n""},{""mc"":1,""mr"":2,""r"":23,""c"":12,""t"":""-\\n""}],[{""mc"":1,""mr"":2,""r"":24,""c"":0,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":24,""c"":1,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":24,""c"":2,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":24,""c"":3,""t"":""Земельный участок\\n""},{""mc"":1,""mr"":1,""r"":24,""c"":4,""t"":""индивидуальная\\n""},{""mc"":1,""mr"":1,""r"":24,""c"":5,""t"":""1339,0\\n""},{""mc"":1,""mr"":1,""r"":24,""c"":6,""t"":""Россия\\n""},{""mc"":1,""mr"":1,""r"":24,""c"":7,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":24,""c"":8,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":24,""c"":9,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":24,""c"":10,""t"":""Прицеп\\nАФ31 АВ\\n""},{""mc"":1,""mr"":1,""r"":24,""c"":11,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":24,""c"":12,""t"":""\\n""}],[{""mc"":1,""mr"":1,""r"":25,""c"":0,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":25,""c"":1,""t"":""Несовершеннолетний ребенок\\n""},{""mc"":1,""mr"":1,""r"":25,""c"":2,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":25,""c"":3,""t"":""-\\n""},{""mc"":1,""mr"":1,""r"":25,""c"":4,""t"":""-\\n""},{""mc"":1,""mr"":1,""r"":25,""c"":5,""t"":""-\\n""},{""mc"":1,""mr"":1,""r"":25,""c"":6,""t"":""-\\n""},{""mc"":1,""mr"":1,""r"":25,""c"":7,""t"":""Квартира\\n""},{""mc"":1,""mr"":1,""r"":25,""c"":8,""t"":""64,1\\n""},{""mc"":1,""mr"":1,""r"":25,""c"":9,""t"":""Россия\\n""},{""mc"":1,""mr"":1,""r"":25,""c"":10,""t"":""-\\n""},{""mc"":1,""mr"":1,""r"":25,""c"":11,""t"":""-\\n""},{""mc"":1,""mr"":1,""r"":25,""c"":12,""t"":""-\\n""}],[{""mc"":1,""mr"":1,""r"":26,""c"":0,""t"":""\\n""},{""mc"":12,""mr"":1,""r"":26,""c"":1,""t"":""ФГУП \\""Орловское протезно-ортопедическое предприятие\\"" Минтруда России\\n""}],[{""mc"":1,""mr"":5,""r"":27,""c"":0,""t"":""4\\n""},{""mc"":1,""mr"":2,""r"":27,""c"":1,""t"":""Дюдин Ю.С.\\n""},{""mc"":1,""mr"":2,""r"":27,""c"":2,""t"":""Заместитель директора\\n""},{""mc"":1,""mr"":1,""r"":27,""c"":3,""t"":""Квартира\\n""},{""mc"":1,""mr"":1,""r"":27,""c"":4,""t"":""долевая, 2/3\\n""},{""mc"":1,""mr"":1,""r"":27,""c"":5,""t"":""58,0\\n""},{""mc"":1,""mr"":1,""r"":27,""c"":6,""t"":""Россия\\n""},{""mc"":1,""mr"":1,""r"":27,""c"":7,""t"":""Жилой дом\\n""},{""mc"":1,""mr"":1,""r"":27,""c"":8,""t"":""46,1\\n""},{""mc"":1,""mr"":1,""r"":27,""c"":9,""t"":""Россия\\n""},{""mc"":1,""mr"":2,""r"":27,""c"":10,""t"":""а/м легковой Volkswagen Sharan\\n""},{""mc"":1,""mr"":2,""r"":27,""c"":11,""t"":""867 956,87\\n""},{""mc"":1,""mr"":2,""r"":27,""c"":12,""t"":""-\\n""}],[{""mc"":1,""mr"":4,""r"":28,""c"":0,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":28,""c"":1,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":28,""c"":2,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":28,""c"":3,""t"":""Квартира\\n""},{""mc"":1,""mr"":1,""r"":28,""c"":4,""t"":""индивидуальная\\n""},{""mc"":1,""mr"":1,""r"":28,""c"":5,""t"":""38,0\\n""},{""mc"":1,""mr"":1,""r"":28,""c"":6,""t"":""Россия\\n""},{""mc"":1,""mr"":1,""r"":28,""c"":7,""t"":""Земельный участок\\n""},{""mc"":1,""mr"":1,""r"":28,""c"":8,""t"":""5000,0\\n""},{""mc"":1,""mr"":1,""r"":28,""c"":9,""t"":""Россия\\n""},{""mc"":1,""mr"":1,""r"":28,""c"":10,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":28,""c"":11,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":28,""c"":12,""t"":""\\n""}],[{""mc"":1,""mr"":3,""r"":29,""c"":0,""t"":""\\n""},{""mc"":1,""mr"":3,""r"":29,""c"":1,""t"":""Супруга\\n""},{""mc"":1,""mr"":3,""r"":29,""c"":2,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":29,""c"":3,""t"":""Комната\\n""},{""mc"":1,""mr"":1,""r"":29,""c"":4,""t"":""индивидуальная\\n""},{""mc"":1,""mr"":1,""r"":29,""c"":5,""t"":""24,0\\n""},{""mc"":1,""mr"":1,""r"":29,""c"":6,""t"":""Россия\\n""},{""mc"":1,""mr"":3,""r"":29,""c"":7,""t"":""Квартира\\n""},{""mc"":1,""mr"":3,""r"":29,""c"":8,""t"":""58,0\\n""},{""mc"":1,""mr"":3,""r"":29,""c"":9,""t"":""Россия\\n""},{""mc"":1,""mr"":3,""r"":29,""c"":10,""t"":""-\\n""},{""mc"":1,""mr"":3,""r"":29,""c"":11,""t"":""96 000,00\\n""},{""mc"":1,""mr"":3,""r"":29,""c"":12,""t"":""-\\n""}],[{""mc"":1,""mr"":2,""r"":30,""c"":0,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":30,""c"":1,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":30,""c"":2,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":30,""c"":3,""t"":""Жилой дом\\n""},{""mc"":1,""mr"":1,""r"":30,""c"":4,""t"":""индивидуальная\\n""},{""mc"":1,""mr"":1,""r"":30,""c"":5,""t"":""46,1\\n""},{""mc"":1,""mr"":1,""r"":30,""c"":6,""t"":""Россия\\n""},{""mc"":1,""mr"":2,""r"":30,""c"":7,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":30,""c"":8,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":30,""c"":9,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":30,""c"":10,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":30,""c"":11,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":30,""c"":12,""t"":""\\n""}]]}"\t"{""persons"":[{""incomes"":[{""relative"":null,""size_raw"":""704 262,72""}],""person"":{""department"":""ФКУ \\""ГБ МСЭ по Вологодской области\\"" Минтруда России"",""name_raw"":""Павлова В.А."",""role"":""Главный бухгалтер""},""real_estates"":[{""country_raw"":""Россия"",""own_type_by_column"":""В собственности"",""own_type_raw"":""индивидуальная"",""relative"":null,""square_raw"":""440,0"",""text"":""Земельный участок"",""type_raw"":""Земельный участок""},{""country_raw"":""Россия"",""own_type_by_column"":""В собственности"",""own_type_raw"":""индивидуальная"",""relative"":null,""square_raw"":""47,0"",""text"":""Квартира"",""type_raw"":""Квартира""},{""country_raw"":""Россия"",""own_type_by_column"":""В собственности"",""own_type_raw"":""индивидуальная"",""relative"":null,""square_raw"":""52,0"",""text"":""Квартира"",""type_raw"":""Квартира""}],""real_estates_count"":3,""year"":""2015""}],""document"":{}}"\t\n8ac2f59bfc12c69db26afb8d5e64c900__11_31\t"{""Title"":""Сведения\\nо доходах, расходах, об имуществе и обязательствах имущественного характера работников организаций созданных для выполнения задач, поставленных перед Минтрудом России (за исключением руководителей данных организаций),\\nза отчетный период с 1 января 2015 года по 31 декабря 2015 года \\n\\n\\n"",""InputFileName"":""documents/34544.docx"",""DataStart"":11,""DataEnd"":31,""Header"":[[{""mc"":1,""mr"":2,""r"":0,""c"":0,""t"":""№\\nп/п\\n""},{""mc"":1,""mr"":2,""r"":0,""c"":1,""t"":""Фамилия и инициалы лица, чьи сведения размещаются\\n""},{""mc"":1,""mr"":2,""r"":0,""c"":2,""t"":""Должность\\n""},{""mc"":4,""mr"":1,""r"":0,""c"":3,""t"":""\\nОбъекты недвижимости, находящиеся в собственности\\n\\n""},{""mc"":3,""mr"":1,""r"":0,""c"":7,""t"":""Объекты недвижимости, находящиеся \\nв пользовании\\n""},{""mc"":1,""mr"":2,""r"":0,""c"":10,""t"":""Транспортные средства\\n(вид, марка)\\n""},{""mc"":1,""mr"":2,""r"":0,""c"":11,""t"":""Декларированный годовой доход 1 за 2015 год (руб.)\\n""},{""mc"":1,""mr"":2,""r"":0,""c"":12,""t"":""Сведения \\nоб источниках получения средств, за счет которых совершена сделка2 (вид приобретенного имущества, источники)\\n""}],[{""mc"":1,""mr"":1,""r"":1,""c"":0,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":1,""c"":1,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":1,""c"":2,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":1,""c"":3,""t"":""вид объекта\\n""},{""mc"":1,""mr"":1,""r"":1,""c"":4,""t"":""вид собственности\\n""},{""mc"":1,""mr"":1,""r"":1,""c"":5,""t"":""площадь (кв.м)\\n""},{""mc"":1,""mr"":1,""r"":1,""c"":6,""t"":""страна распо-ложения\\n""},{""mc"":1,""mr"":1,""r"":1,""c"":7,""t"":""вид объекта\\n""},{""mc"":1,""mr"":1,""r"":1,""c"":8,""t"":""площадь (кв.м)\\n""},{""mc"":1,""mr"":1,""r"":1,""c"":9,""t"":""страна распо-ложения\\n""},{""mc"":1,""mr"":1,""r"":1,""c"":10,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":1,""c"":11,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":1,""c"":12,""t"":""\\n""}]],""Section"":[[{""mc"":1,""mr"":1,""r"":2,""c"":0,""t"":""\\n""},{""mc"":12,""mr"":1,""r"":2,""c"":1,""t"":""ФКУ \\""ГБ МСЭ по Вологодской области\\"" Минтруда России\\n""}]],""Data"":[[{""mc"":1,""mr"":7,""r"":11,""c"":0,""t"":""\\n""},{""mc"":1,""mr"":7,""r"":11,""c"":1,""t"":""\\n""},{""mc"":1,""mr"":7,""r"":11,""c"":2,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":11,""c"":3,""t"":""Земельный участок\\n""},{""mc"":1,""mr"":1,""r"":11,""c"":4,""t"":""индивидуальная\\n""},{""mc"":1,""mr"":1,""r"":11,""c"":5,""t"":""600,0\\n""},{""mc"":1,""mr"":1,""r"":11,""c"":6,""t"":""Россия\\n""},{""mc"":1,""mr"":7,""r"":11,""c"":7,""t"":""\\n""},{""mc"":1,""mr"":7,""r"":11,""c"":8,""t"":""\\n""},{""mc"":1,""mr"":7,""r"":11,""c"":9,""t"":""\\n""},{""mc"":1,""mr"":7,""r"":11,""c"":10,""t"":""\\n""},{""mc"":1,""mr"":7,""r"":11,""c"":11,""t"":""\\n""},{""mc"":1,""mr"":7,""r"":11,""c"":12,""t"":""\\n""}],[{""mc"":1,""mr"":6,""r"":12,""c"":0,""t"":""\\n""},{""mc"":1,""mr"":6,""r"":12,""c"":1,""t"":""\\n""},{""mc"":1,""mr"":6,""r"":12,""c"":2,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":12,""c"":3,""t"":""Земельный участок\\n""},{""mc"":1,""mr"":1,""r"":12,""c"":4,""t"":""индивидуальная\\n""},{""mc"":1,""mr"":1,""r"":12,""c"":5,""t"":""600,0\\n""},{""mc"":1,""mr"":1,""r"":12,""c"":6,""t"":""Россия\\n""},{""mc"":1,""mr"":6,""r"":12,""c"":7,""t"":""\\n""},{""mc"":1,""mr"":6,""r"":12,""c"":8,""t"":""\\n""},{""mc"":1,""mr"":6,""r"":12,""c"":9,""t"":""\\n""},{""mc"":1,""mr"":6,""r"":12,""c"":10,""t"":""\\n""},{""mc"":1,""mr"":6,""r"":12,""c"":11,""t"":""\\n""},{""mc"":1,""mr"":6,""r"":12,""c"":12,""t"":""\\n""}],[{""mc"":1,""mr"":5,""r"":13,""c"":0,""t"":""\\n""},{""mc"":1,""mr"":5,""r"":13,""c"":1,""t"":""\\n""},{""mc"":1,""mr"":5,""r"":13,""c"":2,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":13,""c"":3,""t"":""Земельный участок\\n""},{""mc"":1,""mr"":1,""r"":13,""c"":4,""t"":""индивидуальная\\n""},{""mc"":1,""mr"":1,""r"":13,""c"":5,""t"":""655,0\\n""},{""mc"":1,""mr"":1,""r"":13,""c"":6,""t"":""Россия\\n""},{""mc"":1,""mr"":5,""r"":13,""c"":7,""t"":""\\n""},{""mc"":1,""mr"":5,""r"":13,""c"":8,""t"":""\\n""},{""mc"":1,""mr"":5,""r"":13,""c"":9,""t"":""\\n""},{""mc"":1,""mr"":5,""r"":13,""c"":10,""t"":""\\n""},{""mc"":1,""mr"":5,""r"":13,""c"":11,""t"":""\\n""},{""mc"":1,""mr"":5,""r"":13,""c"":12,""t"":""\\n""}],[{""mc"":1,""mr"":4,""r"":14,""c"":0,""t"":""\\n""},{""mc"":1,""mr"":4,""r"":14,""c"":1,""t"":""\\n""},{""mc"":1,""mr"":4,""r"":14,""c"":2,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":14,""c"":3,""t"":""Земельный участок\\n""},{""mc"":1,""mr"":1,""r"":14,""c"":4,""t"":""индивидуальная\\n""},{""mc"":1,""mr"":1,""r"":14,""c"":5,""t"":""1784,0\\n""},{""mc"":1,""mr"":1,""r"":14,""c"":6,""t"":""Россия\\n""},{""mc"":1,""mr"":4,""r"":14,""c"":7,""t"":""\\n""},{""mc"":1,""mr"":4,""r"":14,""c"":8,""t"":""\\n""},{""mc"":1,""mr"":4,""r"":14,""c"":9,""t"":""\\n""},{""mc"":1,""mr"":4,""r"":14,""c"":10,""t"":""\\n""},{""mc"":1,""mr"":4,""r"":14,""c"":11,""t"":""\\n""},{""mc"":1,""mr"":4,""r"":14,""c"":12,""t"":""\\n""}],[{""mc"":1,""mr"":3,""r"":15,""c"":0,""t"":""\\n""},{""mc"":1,""mr"":3,""r"":15,""c"":1,""t"":""\\n""},{""mc"":1,""mr"":3,""r"":15,""c"":2,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":15,""c"":3,""t"":""Земельный участок\\n""},{""mc"":1,""mr"":1,""r"":15,""c"":4,""t"":""индивидуальная\\n""},{""mc"":1,""mr"":1,""r"":15,""c"":5,""t"":""1300,0\\n""},{""mc"":1,""mr"":1,""r"":15,""c"":6,""t"":""Россия\\n""},{""mc"":1,""mr"":3,""r"":15,""c"":7,""t"":""\\n""},{""mc"":1,""mr"":3,""r"":15,""c"":8,""t"":""\\n""},{""mc"":1,""mr"":3,""r"":15,""c"":9,""t"":""\\n""},{""mc"":1,""mr"":3,""r"":15,""c"":10,""t"":""\\n""},{""mc"":1,""mr"":3,""r"":15,""c"":11,""t"":""\\n""},{""mc"":1,""mr"":3,""r"":15,""c"":12,""t"":""\\n""}],[{""mc"":1,""mr"":2,""r"":16,""c"":0,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":16,""c"":1,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":16,""c"":2,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":16,""c"":3,""t"":""Земельный участок\\n""},{""mc"":1,""mr"":1,""r"":16,""c"":4,""t"":""индивидуальная\\n""},{""mc"":1,""mr"":1,""r"":16,""c"":5,""t"":""616,0\\n""},{""mc"":1,""mr"":1,""r"":16,""c"":6,""t"":""Россия\\n""},{""mc"":1,""mr"":2,""r"":16,""c"":7,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":16,""c"":8,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":16,""c"":9,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":16,""c"":10,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":16,""c"":11,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":16,""c"":12,""t"":""\\n""}],[{""mc"":1,""mr"":1,""r"":17,""c"":0,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":17,""c"":1,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":17,""c"":2,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":17,""c"":3,""t"":""Земельный участок\\n""},{""mc"":1,""mr"":1,""r"":17,""c"":4,""t"":""индивидуальная\\n""},{""mc"":1,""mr"":1,""r"":17,""c"":5,""t"":""616,0\\n""},{""mc"":1,""mr"":1,""r"":17,""c"":6,""t"":""Россия\\n""},{""mc"":1,""mr"":1,""r"":17,""c"":7,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":17,""c"":8,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":17,""c"":9,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":17,""c"":10,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":17,""c"":11,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":17,""c"":12,""t"":""\\n""}],[{""mc"":1,""mr"":3,""r"":18,""c"":0,""t"":""\\n2\\n""},{""mc"":1,""mr"":3,""r"":18,""c"":1,""t"":""Павлова В.А.\\n""},{""mc"":1,""mr"":3,""r"":18,""c"":2,""t"":""Главный  бухгалтер\\n""},{""mc"":1,""mr"":1,""r"":18,""c"":3,""t"":""Земельный участок\\n""},{""mc"":1,""mr"":1,""r"":18,""c"":4,""t"":""индивидуальная\\n""},{""mc"":1,""mr"":1,""r"":18,""c"":5,""t"":""440,0\\n""},{""mc"":1,""mr"":1,""r"":18,""c"":6,""t"":""Россия\\n""},{""mc"":1,""mr"":3,""r"":18,""c"":7,""t"":""-\\n""},{""mc"":1,""mr"":3,""r"":18,""c"":8,""t"":""-\\n""},{""mc"":1,""mr"":3,""r"":18,""c"":9,""t"":""-\\n""},{""mc"":1,""mr"":3,""r"":18,""c"":10,""t"":""-\\n""},{""mc"":1,""mr"":3,""r"":18,""c"":11,""t"":""704 262,72\\n""},{""mc"":1,""mr"":3,""r"":18,""c"":12,""t"":""-\\n""}],[{""mc"":1,""mr"":2,""r"":19,""c"":0,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":19,""c"":1,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":19,""c"":2,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":19,""c"":3,""t"":""Квартира\\n""},{""mc"":1,""mr"":1,""r"":19,""c"":4,""t"":""индивидуальная\\n""},{""mc"":1,""mr"":1,""r"":19,""c"":5,""t"":""52,0\\n""},{""mc"":1,""mr"":1,""r"":19,""c"":6,""t"":""Россия\\n""},{""mc"":1,""mr"":2,""r"":19,""c"":7,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":19,""c"":8,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":19,""c"":9,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":19,""c"":10,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":19,""c"":11,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":19,""c"":12,""t"":""\\n""}],[{""mc"":1,""mr"":1,""r"":20,""c"":0,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":20,""c"":1,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":20,""c"":2,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":20,""c"":3,""t"":""Квартира\\n""},{""mc"":1,""mr"":1,""r"":20,""c"":4,""t"":""индивидуальная\\n""},{""mc"":1,""mr"":1,""r"":20,""c"":5,""t"":""47,0\\n""},{""mc"":1,""mr"":1,""r"":20,""c"":6,""t"":""Россия\\n""},{""mc"":1,""mr"":1,""r"":20,""c"":7,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":20,""c"":8,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":20,""c"":9,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":20,""c"":10,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":20,""c"":11,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":20,""c"":12,""t"":""\\n""}],[{""mc"":1,""mr"":5,""r"":21,""c"":0,""t"":""3\\n""},{""mc"":1,""mr"":2,""r"":21,""c"":1,""t"":""Кокореева И.А.\\n""},{""mc"":1,""mr"":2,""r"":21,""c"":2,""t"":""Заместитель руководителя по общим вопросам \\n""},{""mc"":1,""mr"":1,""r"":21,""c"":3,""t"":""Квартира\\n""},{""mc"":1,""mr"":1,""r"":21,""c"":4,""t"":""индивидуальная\\n""},{""mc"":1,""mr"":1,""r"":21,""c"":5,""t"":""64,1\\n""},{""mc"":1,""mr"":1,""r"":21,""c"":6,""t"":""Россия\\n""},{""mc"":1,""mr"":2,""r"":21,""c"":7,""t"":""-\\n""},{""mc"":1,""mr"":2,""r"":21,""c"":8,""t"":""-\\n""},{""mc"":1,""mr"":2,""r"":21,""c"":9,""t"":""-\\n""},{""mc"":1,""mr"":2,""r"":21,""c"":10,""t"":""-\\n""},{""mc"":1,""mr"":2,""r"":21,""c"":11,""t"":""719 536,60\\n""},{""mc"":1,""mr"":2,""r"":21,""c"":12,""t"":""-\\n""}],[{""mc"":1,""mr"":4,""r"":22,""c"":0,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":22,""c"":1,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":22,""c"":2,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":22,""c"":3,""t"":""Комната\\n""},{""mc"":1,""mr"":1,""r"":22,""c"":4,""t"":""индивидуальная\\n""},{""mc"":1,""mr"":1,""r"":22,""c"":5,""t"":""11,5\\n""},{""mc"":1,""mr"":1,""r"":22,""c"":6,""t"":""Россия\\n""},{""mc"":1,""mr"":1,""r"":22,""c"":7,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":22,""c"":8,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":22,""c"":9,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":22,""c"":10,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":22,""c"":11,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":22,""c"":12,""t"":""\\n""}],[{""mc"":1,""mr"":3,""r"":23,""c"":0,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":23,""c"":1,""t"":""Супруг\\n""},{""mc"":1,""mr"":2,""r"":23,""c"":2,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":23,""c"":3,""t"":""Гаражный бокс\\n""},{""mc"":1,""mr"":1,""r"":23,""c"":4,""t"":""индивидуальная\\n""},{""mc"":1,""mr"":1,""r"":23,""c"":5,""t"":""23,3\\n""},{""mc"":1,""mr"":1,""r"":23,""c"":6,""t"":""Россия\\n""},{""mc"":1,""mr"":2,""r"":23,""c"":7,""t"":""Квартира\\n""},{""mc"":1,""mr"":2,""r"":23,""c"":8,""t"":""64,1\\n""},{""mc"":1,""mr"":2,""r"":23,""c"":9,""t"":""Россия\\n""},{""mc"":1,""mr"":1,""r"":23,""c"":10,""t"":""а/м легковой\\nРено Дастер\\n""},{""mc"":1,""mr"":2,""r"":23,""c"":11,""t"":""167 643,38\\n""},{""mc"":1,""mr"":2,""r"":23,""c"":12,""t"":""-\\n""}],[{""mc"":1,""mr"":2,""r"":24,""c"":0,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":24,""c"":1,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":24,""c"":2,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":24,""c"":3,""t"":""Земельный участок\\n""},{""mc"":1,""mr"":1,""r"":24,""c"":4,""t"":""индивидуальная\\n""},{""mc"":1,""mr"":1,""r"":24,""c"":5,""t"":""1339,0\\n""},{""mc"":1,""mr"":1,""r"":24,""c"":6,""t"":""Россия\\n""},{""mc"":1,""mr"":1,""r"":24,""c"":7,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":24,""c"":8,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":24,""c"":9,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":24,""c"":10,""t"":""Прицеп\\nАФ31 АВ\\n""},{""mc"":1,""mr"":1,""r"":24,""c"":11,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":24,""c"":12,""t"":""\\n""}],[{""mc"":1,""mr"":1,""r"":25,""c"":0,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":25,""c"":1,""t"":""Несовершеннолетний ребенок\\n""},{""mc"":1,""mr"":1,""r"":25,""c"":2,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":25,""c"":3,""t"":""-\\n""},{""mc"":1,""mr"":1,""r"":25,""c"":4,""t"":""-\\n""},{""mc"":1,""mr"":1,""r"":25,""c"":5,""t"":""-\\n""},{""mc"":1,""mr"":1,""r"":25,""c"":6,""t"":""-\\n""},{""mc"":1,""mr"":1,""r"":25,""c"":7,""t"":""Квартира\\n""},{""mc"":1,""mr"":1,""r"":25,""c"":8,""t"":""64,1\\n""},{""mc"":1,""mr"":1,""r"":25,""c"":9,""t"":""Россия\\n""},{""mc"":1,""mr"":1,""r"":25,""c"":10,""t"":""-\\n""},{""mc"":1,""mr"":1,""r"":25,""c"":11,""t"":""-\\n""},{""mc"":1,""mr"":1,""r"":25,""c"":12,""t"":""-\\n""}],[{""mc"":1,""mr"":1,""r"":26,""c"":0,""t"":""\\n""},{""mc"":12,""mr"":1,""r"":26,""c"":1,""t"":""ФГУП \\""Орловское протезно-ортопедическое предприятие\\"" Минтруда России\\n""}],[{""mc"":1,""mr"":5,""r"":27,""c"":0,""t"":""4\\n""},{""mc"":1,""mr"":2,""r"":27,""c"":1,""t"":""Дюдин Ю.С.\\n""},{""mc"":1,""mr"":2,""r"":27,""c"":2,""t"":""Заместитель директора\\n""},{""mc"":1,""mr"":1,""r"":27,""c"":3,""t"":""Квартира\\n""},{""mc"":1,""mr"":1,""r"":27,""c"":4,""t"":""долевая, 2/3\\n""},{""mc"":1,""mr"":1,""r"":27,""c"":5,""t"":""58,0\\n""},{""mc"":1,""mr"":1,""r"":27,""c"":6,""t"":""Россия\\n""},{""mc"":1,""mr"":1,""r"":27,""c"":7,""t"":""Жилой дом\\n""},{""mc"":1,""mr"":1,""r"":27,""c"":8,""t"":""46,1\\n""},{""mc"":1,""mr"":1,""r"":27,""c"":9,""t"":""Россия\\n""},{""mc"":1,""mr"":2,""r"":27,""c"":10,""t"":""а/м легковой Volkswagen Sharan\\n""},{""mc"":1,""mr"":2,""r"":27,""c"":11,""t"":""867 956,87\\n""},{""mc"":1,""mr"":2,""r"":27,""c"":12,""t"":""-\\n""}],[{""mc"":1,""mr"":4,""r"":28,""c"":0,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":28,""c"":1,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":28,""c"":2,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":28,""c"":3,""t"":""Квартира\\n""},{""mc"":1,""mr"":1,""r"":28,""c"":4,""t"":""индивидуальная\\n""},{""mc"":1,""mr"":1,""r"":28,""c"":5,""t"":""38,0\\n""},{""mc"":1,""mr"":1,""r"":28,""c"":6,""t"":""Россия\\n""},{""mc"":1,""mr"":1,""r"":28,""c"":7,""t"":""Земельный участок\\n""},{""mc"":1,""mr"":1,""r"":28,""c"":8,""t"":""5000,0\\n""},{""mc"":1,""mr"":1,""r"":28,""c"":9,""t"":""Россия\\n""},{""mc"":1,""mr"":1,""r"":28,""c"":10,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":28,""c"":11,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":28,""c"":12,""t"":""\\n""}],[{""mc"":1,""mr"":3,""r"":29,""c"":0,""t"":""\\n""},{""mc"":1,""mr"":3,""r"":29,""c"":1,""t"":""Супруга\\n""},{""mc"":1,""mr"":3,""r"":29,""c"":2,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":29,""c"":3,""t"":""Комната\\n""},{""mc"":1,""mr"":1,""r"":29,""c"":4,""t"":""индивидуальная\\n""},{""mc"":1,""mr"":1,""r"":29,""c"":5,""t"":""24,0\\n""},{""mc"":1,""mr"":1,""r"":29,""c"":6,""t"":""Россия\\n""},{""mc"":1,""mr"":3,""r"":29,""c"":7,""t"":""Квартира\\n""},{""mc"":1,""mr"":3,""r"":29,""c"":8,""t"":""58,0\\n""},{""mc"":1,""mr"":3,""r"":29,""c"":9,""t"":""Россия\\n""},{""mc"":1,""mr"":3,""r"":29,""c"":10,""t"":""-\\n""},{""mc"":1,""mr"":3,""r"":29,""c"":11,""t"":""96 000,00\\n""},{""mc"":1,""mr"":3,""r"":29,""c"":12,""t"":""-\\n""}],[{""mc"":1,""mr"":2,""r"":30,""c"":0,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":30,""c"":1,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":30,""c"":2,""t"":""\\n""},{""mc"":1,""mr"":1,""r"":30,""c"":3,""t"":""Жилой дом\\n""},{""mc"":1,""mr"":1,""r"":30,""c"":4,""t"":""индивидуальная\\n""},{""mc"":1,""mr"":1,""r"":30,""c"":5,""t"":""46,1\\n""},{""mc"":1,""mr"":1,""r"":30,""c"":6,""t"":""Россия\\n""},{""mc"":1,""mr"":2,""r"":30,""c"":7,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":30,""c"":8,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":30,""c"":9,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":30,""c"":10,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":30,""c"":11,""t"":""\\n""},{""mc"":1,""mr"":2,""r"":30,""c"":12,""t"":""\\n""}]]}"\t"{""persons"":[{""incomes"":[{""relative"":null,""size_raw"":""704 262,72""}],""person"":{""department"":""ФКУ \\""ГБ МСЭ по Вологодской области\\"" Минтруда России"",""name_raw"":""Павлова В.А."",""role"":""Главный бухгалтер""},""real_estates"":[{""country_raw"":""Россия"",""own_type_by_column"":""В собственности"",""own_type_raw"":""индивидуальная"",""relative"":null,""square_raw"":""440,0"",""text"":""Земельный участок"",""type_raw"":""Земельный участок""},{""country_raw"":""Россия"",""own_type_by_column"":""В собственности"",""own_type_raw"":""индивидуальная"",""relative"":null,""square_raw"":""47,0"",""text"":""Квартира"",""type_raw"":""Квартира""},{""country_raw"":""Россия"",""own_type_by_column"":""В собственности"",""own_type_raw"":""индивидуальная"",""relative"":null,""square_raw"":""52,0"",""text"":""Квартира"",""type_raw"":""Квартира""}],""real_estates_count"":3,""year"":""2015""}],""document"":{}}"\t';
let jsonStr = tsvLine.split("\t")[1];
jsonStr = jsonStr.replace(/""/g, '"');
jsonStr = jsonStr.replace(/^"/, '');
jsonStr = jsonStr.replace(/"$/, '');
let context = {input_id: "1", input_json: jsonStr, declaration_json:"hkfhggkfjhgfk"};
let html  = handleBarsTemplate(context);
taskSource.innerHTML = html;

let button = document.createElement("button");
button.onclick = on_toloka_validate;
button.innerHTML = "<h1>Next Task</h1>";
let body = document. getElementsByTagName("body")[0];
body.appendChild(button);
