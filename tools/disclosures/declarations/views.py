from . import models
from .forms import SearchForm
from django.views import generic
from django.db.models import Q
from django.views.generic.edit import FormView
from .dlrobot_human_common import dhjs


class SectionView(generic.DetailView):
    model = models.Section
    template_name = 'section/detail.html'


class PersonView(generic.DetailView):
    model = models.Person
    template_name = 'person/detail.html'


class HomePageView(generic.TemplateView):
    template_name = 'morda/index.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['form'] = SearchForm
        return context


class StatisticsView(generic.TemplateView):
    template_name = "statistics/statistics.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['spjsonfile_count'] = models.SPJsonFile.objects.all().count()
        context['spjsonfile_only_dlrobot_count'] = models.SPJsonFile.objects.filter(intersection_status=dhjs.only_dlrobot).count()
        context['spjsonfile_only_human_count'] = models.SPJsonFile.objects.filter(intersection_status=dhjs.only_human).count()
        context['spjsonfile_both_found_count'] = models.SPJsonFile.objects.filter(intersection_status=dhjs.both_found).count()

        context['sections_count'] = models.Section.objects.all().count()
        context['sections_count_only_dlrobot'] = models.Section.objects.filter(
            spjsonfile__intersection_status=dhjs.only_dlrobot).count()
        context['sections_dedupe_score_greater_0'] = models.Section.objects.filter(
            dedupe_score__gt=0).count()



        context['person_count'] = models.Person.objects.all().count()
        return context


class SearchResultsView(FormView, generic.ListView):
    model = models.Section
    paginate_by = 40
    form_class = SearchForm

    def get_template_names(self):
        search_object_type = self.request.GET.get('search_object_type')
        if search_object_type == "people_search":
            return 'person/search_results.html'
        return 'section/search_results.html'

    def get_queryset(self):
        query = self.request.GET.get('q')
        search_object_type = self.request.GET.get('search_object_type')

        if search_object_type == "people_search":
            object_list = models.Person.objects.filter(
                Q(section__person_name__istartswith=query)
            ).distinct().order_by('id')
        else:
            object_list = models.Section.objects.filter(
                Q(person_name__istartswith=query)
            ).order_by('person_name', 'income_year')
        return object_list

    def get_initial(self):
        return {'q': self.request.GET["q"],
                'search_object_type': self.request.GET["search_object_type"]
                }
