# -*- coding: utf-8 -*-

# Define your item pipelines here
#
# Don't forget to add your pipeline to the ITEM_PIPELINES setting
# See: http://doc.scrapy.org/en/latest/topics/item-pipeline.html
import json
from scrapy.exporters import JsonLinesItemExporter
from scrapy.exporters import CsvItemExporter
from scrapy import signals
import re

# Processes each item returned by the Reddit_Spider
# Makes sure they are in right data format and are regex'd properly
class RedditScraperPipeline(object):
    def process_item(self, item, spider):
        item['title'] = item['title'][0]
        item['comments'] = int(re.match(r'([0-9]+).*comments.*', item['comments'][0]).group(1))
        item['post_num'] = int(item['post_num'][0])
        item['posting_time'] = item['posting_time'][0]
        item['subreddit'] = item['subreddit'][0]
        item['url'] = item['url'][0]
        item['domain'] = item['domain'][0]
        item['votes'] = int(item['votes'][0])
        return item


# Defunct, class to write to JSON file. CSV write preffered due to structure of data
class JsonWriterPipeline(object):

    def __init__(self):
        self.file = open('top_posts.csv', 'w+b')

    def spider_opened(self, spider):
        file = open('top_posts.csv', 'w+b')
        self.exporter = JsonLinesItemExporter(self.file)
        self.exporter.start_exporting()

    def spider_closed(self, spider):
        self.exporter.finish_exporting()
        self.file.close()

    def process_item(self, item, spider):
        JsonLinesItemExporter(self.file).export_item(item)
        return item

# Writes each item to the file top_posts.csv
# Also makes sure there is a header
class CSVWriterPipeline(object):
    @classmethod
    def from_crawler(cls, crawler):
        pipeline = cls()
        crawler.signals.connect(pipeline.spider_opened, signals.spider_opened)
        crawler.signals.connect(pipeline.spider_closed, signals.spider_closed)
        return pipeline

    def spider_opened(self, spider):
        self.file = open('top_posts.csv', 'w+b')
        self.exporter = CsvItemExporter(self.file)
        self.exporter.start_exporting()

    def spider_closed(self, spider):
        self.exporter.finish_exporting()
        self.file.close()

    def process_item(self, item, spider):
        self.exporter.export_item(item)
        return item
