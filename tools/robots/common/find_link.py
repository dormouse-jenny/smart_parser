import logging
import urllib.error
import urllib.parse
from robots.common.download import are_web_mirrors
from robots.common.popular_sites import is_super_popular_domain
from robots.common.http_request import consider_request_policy
from robots.common.primitives import get_site_domain_wo_www
from selenium.common.exceptions import WebDriverException
import re
from DeclDocRecognizer.dlrecognizer import DL_RECOGNIZER_ENUM


class TClickEngine:
    urllib = 'urllib'
    selenium = 'selenium'
    google = 'google'
    manual = 'manual'


class TLinkInfo:
    MINIMAL_LINK_WEIGHT = 0.0

    def __init__(self, engine, source, target, page_html="", element_index=0, anchor_text="", tag_name=None):
        self.Engine = engine
        self.ElementIndex = element_index
        self.PageHtml = "" if page_html is None else page_html
        self.SourceUrl = source
        self.TargetUrl = target
        self.AnchorText = ""
        self.set_anchor_text(anchor_text)
        self.TagName = tag_name
        self.AnchorTextFoundSomewhere = False
        self.DownloadedFile = None
        self.TargetTitle = None
        self.Weight = TLinkInfo.MINIMAL_LINK_WEIGHT
        self.dl_recognizer_result = DL_RECOGNIZER_ENUM.UNKNOWN

    def set_anchor_text(self, anchor_text):
        self.AnchorText = '' if anchor_text is None else anchor_text.strip(" \r\n\t")

    def to_json(self):
        rec = {
            'src': self.SourceUrl,
            'trg': self.TargetUrl,
            'text': self.AnchorText,
            'engine': self.Engine,
            'element_index': self.ElementIndex,
        }
        if self.TagName is not None:
            rec['tagname'] = self.TagName
        if self.AnchorTextFoundSomewhere:
            rec['text_proxim'] = True
        if self.DownloadedFile is not None:
            rec['downloaded_file'] = self.DownloadedFile
        if self.Weight != 0.0:
            rec['link_weight'] = self.Weight
        if self.dl_recognizer_result != DL_RECOGNIZER_ENUM.UNKNOWN:
            rec['dl_recognizer_result'] = self.dl_recognizer_result
        return rec

    def from_json(self, rec):
        self.SourceUrl = rec['src']
        self.TargetUrl = rec['trg']
        self.AnchorText = rec['text']
        self.Engine = rec['engine']
        self.ElementIndex = rec['element_index']
        self.TagName = rec.get('tagname')
        self.AnchorTextFoundSomewhere = rec.get('text_proxim', False)
        self.DownloadedFile = rec.get('downloaded_file')
        self.Weight = rec.get('link_weight', 0.0)
        self.dl_recognizer_result = rec.get('dl_recognizer_result', DL_RECOGNIZER_ENUM.UNKNOWN)
        return self


def get_office_domain(web_domain):
    index = 2
    if web_domain.endswith("gov.ru"):
        index = 3 #minpromtorg.gov.ru

    return ".".join(web_domain.split(".")[-index:])


def check_href_elementary(href):
    if href.startswith('mailto:'):
        return False
    if href.startswith('tel:'):
        return False
    if href.startswith('javascript:'):
        return False
    if href.startswith('about:'):
        return False
    if href.startswith('consultantplus:'):
        return False
    if href.startswith('#'):
        if not href.startswith('#!'): # it is a hashbang (a starter for AJAX url) http://minpromtorg.gov.ru/open_ministry/anti/
            return False
    return True


def web_link_is_absolutely_prohibited(source, href):
    if len(href) == 0:
        return True
    if href.find('redirect') != -1:
        return True
    if not check_href_elementary(href):
        return True
    if source.strip('/') == href.strip('/'):
        return True
    if href.find(' ') != -1 or href.find('\n') != -1 or href.find('\t') != -1:
        return True
    if href.find('print=') != -1:
        return True
    href_domain = get_site_domain_wo_www(href)
    source_domain = get_site_domain_wo_www(source)
    if is_super_popular_domain(href_domain):
        return True
    href_domain = re.sub(':[0-9]+$', '', href_domain) # delete port
    source_domain = re.sub(':[0-9]+$', '', source_domain)  # delete port

    if get_office_domain(href_domain) != get_office_domain(source_domain):
        if not are_web_mirrors(source_domain, href_domain):
            return True
    return False


def make_link(main_url, href):
    url = urllib.parse.urljoin(main_url, href)
    # see http://minpromtorg.gov.ru/open_ministry/anti/activities/info/
    #i = url.find('#')
    #if i != -1:
    #    url = url[0:i]
    return url


def get_base_url(main_url, soup):
    for l in soup.findAll('base'):
        href = l.attrs.get('href')
        if href is not None:
            return href
    return main_url


def get_soup_title(soup):
    if soup.title is None:
        return ""
    if soup.title.string is None:
        return ""
    return soup.title.string


def find_links_in_html_by_text(step_info, main_url, soup):
    logger = logging.getLogger("dlrobot_logger")
    base = get_base_url(main_url, soup)
    if base.startswith('/'):
        base = make_link(main_url, base)
    page_html = str(soup)
    element_index = 0
    links_to_process = list(soup.findAll('a'))
    logger.debug("find_links_in_html_by_text url={} links_count={}".format(main_url, len(links_to_process)))
    for l in links_to_process:
        href = l.attrs.get('href')
        if href is not None:
            element_index += 1
            link_info = TLinkInfo(TClickEngine.urllib, main_url, make_link(base, href),
                                  page_html=page_html, anchor_text=l.text, tag_name=l.name, element_index=element_index)
            if step_info.normalize_and_check_link(link_info):
                step_info.add_link_wrapper(link_info)

    for l in soup.findAll('iframe'):
        href = l.attrs.get('src')
        if href is not None:
            element_index += 1
            link_info = TLinkInfo(TClickEngine.urllib, main_url, make_link(base, href),
                                  page_html=page_html, anchor_text=l.text, tag_name=l.name, element_index=element_index)
            if step_info.normalize_and_check_link(link_info):
                step_info.add_link_wrapper(link_info)


def click_selenium_if_no_href(step_info, main_url, driver_holder,  element, element_index):
    tag_name = element.tag_name
    link_text = element.text.strip('\n\r\t ')  # initialize here, can be broken after click
    page_html = driver_holder.the_driver.page_source
    consider_request_policy(main_url + " elem_index=" + str(element_index), "click_selenium")

    link_info = TLinkInfo(TClickEngine.selenium, main_url, None,
                          page_html=page_html, anchor_text=link_text, tag_name=tag_name, element_index=element_index)

    driver_holder.click_element(element, link_info)

    if step_info.normalize_and_check_link(link_info):
        if link_info.DownloadedFile is not None:
            step_info.add_downloaded_file_wrapper(link_info)
        elif link_info.TargetUrl is not None:
            step_info.add_link_wrapper(link_info)


def click_all_selenium(step_info, main_url, driver_holder):
    logger = step_info.website.logger
    logger.debug("find_links_with_selenium url={}".format(main_url))
    consider_request_policy(main_url, "GET_selenium")
    elements = driver_holder.navigate_and_get_links(main_url)
    page_html = driver_holder.the_driver.page_source
    for element_index in range(len(elements)):
        element = elements[element_index]
        link_text = element.text.strip('\n\r\t ') if element.text is not None else ""
        if len(link_text) == 0:
            continue
        href = element.get_attribute('href')
        if href is not None:
            href = make_link(main_url, href) # may be we do not need it in selenium?
            link_info = TLinkInfo(TClickEngine.selenium, main_url, href,
                                  page_html=page_html, anchor_text=link_text,  tag_name=element.tag_name, element_index=element_index)
            if step_info.normalize_and_check_link(link_info):
                step_info.add_link_wrapper(link_info)
        else:
            only_anchor_text = TLinkInfo(TClickEngine.selenium, main_url, None, page_html=page_html, anchor_text=link_text)
            if step_info.normalize_and_check_link(only_anchor_text):
                logger.debug("click element {}".format(element_index))
                try:
                    click_selenium_if_no_href(step_info, main_url, driver_holder,  element, element_index)
                    elements = driver_holder.get_buttons_and_links()
                except WebDriverException as exp:
                    logger.error("exception: {}, try restart and get the next element".format(str(exp)))
                    driver_holder.restart()
                    elements = driver_holder.navigate_and_get_links(main_url)

