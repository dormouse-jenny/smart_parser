import os
from pathlib import Path
import time
import logging
from bs4 import BeautifulSoup
import shutil
from urllib.parse import urljoin
from download import download_with_cache, ACCEPTED_DECLARATION_FILE_EXTENSIONS, \
    save_download_file, DEFAULT_HTML_EXTENSION, get_file_extension_by_cached_url, get_site_domain_wo_www
from content_types import  ALL_CONTENT_TYPES
from selenium import webdriver
from selenium.webdriver.firefox.options import Options as FirefoxOptions

class TLinkInfo:
    def __init__(self, text, source=None, target=None, tagName=None, download_file=None):
        self.Source = source
        self.Target = target
        self.Text = text
        self.TagName = tagName
        self.DownloadFile = download_file

def strip_viewer_prefix(href):
    # https://docs.google.com/viewer?url=https%3A%2F%2Foren-rshn.ru%2Findex.php%3Fdo%3Ddownload%26id%3D247%26area%3Dstatic%26viewonline%3D1
    viewers = ['https://docs.google.com/viewer?url=',
                'https://docviewer.yandex.ru/?url=',
                'https://view.officeapps.live.com/op/embed.aspx?src=',
                'https://view.officeapps.live.com/op/view.aspx?src=']
    for prefix in viewers:
        if href.startswith(prefix):
            href = href[len(prefix):]
            return urllib.parse.unquote(href)
    return href

def strip_html_url(url):
    if url.endswith('.html'):
        url = url[:-len('.html')]
    if url.endswith('.htm'):
        url = url[:-len('.htm')]
    if url.startswith('http://'):
        url = url[len('http://'):]
    if url.startswith('http://'):
        url = url[len('https://'):]
    if url.startswith('www.'):
        url = url[len('www.'):]
    return url

def check_sub_page_or_iframe(link_info):
    if not check_self_link(link_info):
        return False
    if link_info.Target is None:
        return False
    if link_info.TagName is not None and link_info.TagName.lower() == "iframe":
        return True
    parent = strip_html_url(link_info.Source)
    subpage = strip_html_url(link_info.Target)
    return subpage.startswith(parent)


def check_self_link(link_info):
    if link_info.Target != None:
        if len(link_info.Target) == 0:
            return False
        if link_info.Target.find('redirect') != -1:
            return False
        if link_info.Source.strip('/') == link_info.Target.strip('/'):
            return False
    return True


def check_anticorr_link_text(link_info):
    if not check_self_link(link_info):
        return False

    text = link_info.Text.strip().lower()
    if text.startswith(u'противодействие'):
        return text.find("коррупц") != -1

    return False


def make_link(main_url, href):
    url = urljoin(main_url, href)
    # see http://minpromtorg.gov.ru/open_ministry/anti/activities/info/
    #i = url.find('#')
    #if i != -1:
    #    url = url[0:i]
    return url

class SomeOtherTextException(Exception):
    def __init__(self, value):
        self.value = value
    def __str__(self):
        return (repr(self.value))


def find_recursive_to_bottom (start_element, check_link_func, element):
    children = element.findChildren()
    if len(children) == 0:
        if len(element.text) > 0 and element != start_element:
            if check_link_func(TLinkInfo(element.text)):
                return element.text
            if len (element.text.strip()) > 10:
                raise SomeOtherTextException (element.text.strip())
    else:
        for child in children:
            found_text = find_recursive_to_bottom(start_element,check_link_func, child)
            if len(found_text) > 0:
                return found_text
    return ""


def check_long_near_text (start_element, upward_distance, check_link_func):
    # go to the top
    element = start_element
    for i in range(upward_distance):
        element = element.parent
        if element is None:
            return ""
        # go to the bottom
        found_text = find_recursive_to_bottom (start_element, check_link_func, element)
        if len(found_text) > 0:
            return found_text
    return ""


def can_be_office_document(href):
    global ACCEPTED_DECLARATION_FILE_EXTENSIONS
    filename, file_extension = os.path.splitext(href)
    if file_extension.lower() in ACCEPTED_DECLARATION_FILE_EXTENSIONS:
        return True
    if href.find('docs.google') != -1:
        return True
    return False


def get_base_url(main_url, soup):
    for l in soup.findAll('base'):
        href = l.attrs.get('href')
        if href is not None:
            return href
    return main_url


def check_http(href):
    if href.startswith('mailto:'):
        return False
    if href.startswith('tel:'):
        return False
    if href.startswith('javascript:'):
        return False
    return True



def find_links_in_html_by_text(main_url, soup, check_link_func, office_section):
    logger = logging.getLogger("dlrobot_logger")
    if can_be_office_document(main_url):
        return
    base = get_base_url(main_url, soup)
    logger.debug("find_links_in_html_by_text function={0}".format(check_link_func))
    all_links_count = 0
    for l in soup.findAll('a'):
        href = l.attrs.get('href')
        if href is not None:
            all_links_count += 1
            if not check_http(href):
                continue
            logger.debug("check link {0}".format(href))
            href = strip_viewer_prefix( make_link(base, href) )
            if  check_link_func( TLinkInfo(l.text, main_url, href, l.name) ):
                record = {
                    'text': l.text,
                    'engine': 'urllib',
                    'source': main_url,
                    'tagname': l.name,
                }
                office_section.add_link(href, record)
            else:
                if can_be_office_document(href):
                    found_text = ""
                    try:
                        if check_link_func(TLinkInfo(soup.title.string, main_url, href, l.name)):
                            found_text = soup.title.string
                        else:
                            found_text = check_long_near_text(l, 3, check_link_func)
                    except SomeOtherTextException as err:
                        continue
                    if len(found_text) > 0:
                        record = {
                            'text': found_text,
                            'engine': 'urllib',
                            'source':  main_url,
                            'text_proxim': True,
                            'tagname': l.name,
                        }
                        office_section.add_link(href, record)

    for l in soup.findAll('iframe'):
        href = l.attrs.get('src')
        if href is not None:
            all_links_count += 1
            if not check_http(href):
                continue

            href = make_link(base, href)
            if check_link_func( TLinkInfo(l.text, main_url, href, l.name) ):
                record = {
                    'text': l.text,
                    'engine': 'urllib',
                    'source':  main_url,
                    'tagname': l.name,
                }
                office_section.add_link(href, record)




TMP_DOWNLOAD_FOLDER = None
def recreate_tmp_download_folder():
    global TMP_DOWNLOAD_FOLDER
    TMP_DOWNLOAD_FOLDER = os.path.join(os.getcwd(), "tmp_download")
    if os.path.exists(TMP_DOWNLOAD_FOLDER):
        shutil.rmtree(TMP_DOWNLOAD_FOLDER)
    os.makedirs(TMP_DOWNLOAD_FOLDER)


def open_selenium():
    global TMP_DOWNLOAD_FOLDER
    recreate_tmp_download_folder()

    options = FirefoxOptions()
    options.headless = True
    options.set_preference("browser.download.folderList", 2)
    options.set_preference("browser.download.manager.showWhenStarting", False)
    options.set_preference("browser.download.manager.closeWhenDone", True)
    options.set_preference("browser.download.manager.focusWhenStarting", False)
    options.set_preference("browser.download.dir", TMP_DOWNLOAD_FOLDER)
    options.set_preference("browser.helperApps.neverAsk.saveToDisk", ALL_CONTENT_TYPES)
    options.set_preference("browser.helperApps.alwaysAsk.force", False)
    return webdriver.Firefox(firefox_options=options)


def wait_download_finished(timeout=120):
    global TMP_DOWNLOAD_FOLDER
    dl_wait = True
    seconds = 0
    while dl_wait and seconds < timeout:
        firefox_temp_file = sorted(Path(TMP_DOWNLOAD_FOLDER).glob('*.part'))
        chrome_temp_file = sorted(Path(TMP_DOWNLOAD_FOLDER).glob('*.crdownload'))
        if (len(firefox_temp_file) == 0) and \
           (len(chrome_temp_file) == 0):
            files = os.listdir(TMP_DOWNLOAD_FOLDER)
            if len(files) > 0:
                return save_download_file(os.path.join(TMP_DOWNLOAD_FOLDER, files[0]))
            return None
        time.sleep(1)
        seconds += 1
    return None


def find_links_with_selenium (main_url, check_link_func, office_section):
    logger = logging.getLogger("dlrobot_logger")
    if can_be_office_document(main_url):
        return
    logger.debug("find_links_with_selenium url={0}, function={1}".format(main_url, check_link_func))
    driver = open_selenium()

    driver.get(main_url)
    time.sleep(6)
    elements = list(driver.find_elements_by_xpath('//button | //a'))

    for i in range(len(elements)):
        e = elements[i]
        tag_name = e.tag_name
        link_text = e.text.strip('\n\r\t ') #initialize here, can be broken after click
        logger.debug("check link url={0}, function={1}".format(main_url, check_link_func))
        if check_link_func(TLinkInfo(link_text)):
            recreate_tmp_download_folder()
            e.click()
            time.sleep(6)
            downloaded_file = wait_download_finished(120)
            link_url = driver.current_url
            if check_link_func(TLinkInfo(link_text, main_url, link_url, tag_name, downloaded_file)):
                record = {
                    'text': link_text,
                    'engine': 'selenium',
                    'source':  main_url,
                    'tagname': tag_name,
                    'title': driver.title
                }
                if downloaded_file is not None:
                    record['downloaded_file'] = downloaded_file
                    record['element_index'] = i
                    office_section.add_downloaded_file(record)
                else:
                    office_section.add_link(link_url, record)
            driver.back()
            elements = list(driver.find_elements_by_xpath('//button | //a'))
    driver.quit()



def add_links(ad, url, check_link_func, fallback_to_selenium=True):
    html = ""
    logger = logging.getLogger("dlrobot_logger")
    try:
        html = download_with_cache(url)
    except Exception as err:
        logger.error('cannot download page url={0} while add_links, exception={1}\n'.format(url, str(err)))
        return

    if get_file_extension_by_cached_url(url) != DEFAULT_HTML_EXTENSION:
        logger.debug("cannot get links  since it is not html: {0}".format(url))
        return

    try:
        soup = BeautifulSoup(html, "html.parser")

        save_links_count = len(ad.found_links)
        find_links_in_html_by_text(url, soup, check_link_func, ad)

        # see http://minpromtorg.gov.ru/docs/#!svedeniya_o_dohodah_rashodah_ob_imushhestve_i_obyazatelstvah_imushhestvennogo_haraktera_federalnyh_gosudarstvennyh_grazhdanskih_sluzhashhih_minpromtorga_rossii_rukovodstvo_a_takzhe_ih_suprugi_supruga_i_nesovershennoletnih_detey_za_period_s_1_yanvarya_2018_g_po_31_dekabrya_2018_g
        if save_links_count == len(ad.found_links) and fallback_to_selenium:
            find_links_with_selenium(url, check_link_func, ad)

    except Exception as err:
        logger.error('cannot download page url={0} while find_links, exception={1}\n'.format(url, str(err)))


def find_links_for_one_website(start_pages, target, check_link_func, fallback_to_selenium=False, transitive=False):
    while True:
        save_count = len(target.found_links)

        for url in start_pages:
            add_links(target, url, check_link_func, fallback_to_selenium)

        new_count = len(target.found_links)
        if not transitive or save_count == new_count:
            break


