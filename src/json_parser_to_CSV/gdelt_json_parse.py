import json
import csv

# CSV header: id, source, target, size, count,
with open('gdelt_raw_edges.json') as edge_file:
    edges = json.load(edge_file)
    formatted_data = []
    for line in edges:
        row = line["id"] + "," + line["source"] + "," + line["target"] + "," + str(line["size"]) + "," + line["attributes"]["Count"]
        print(row)
        formatted_data.append(row)

    with open('gdelt_edges.csv', 'w') as f:
        f.write("id,source,target,size,count\n")
        for data in formatted_data:
            f.write(data + "\n")

# {"label": "globenewswire.com", "attributes": {"Modularity Class": "28", "PageRank": "4.817689475053663E-4"}, "id": "globenewswire.com"},
# CSV header: id,label,page_rank,modularity_class
with open('gdelt_raw_nodes.json') as node_file:
    nodes = json.load(node_file)
    formatted_data = []
    non_eng_nodes = []
    for line in nodes:

        row = line["id"] + "," + line["label"] + ","

        if line["attributes"]["PageRank"]:
            row = row + str(int(10000000000 * float(line["attributes"]["PageRank"])))
        row = row + ","

        if line["attributes"]["Modularity Class"]:
            row = row + line["attributes"]["Modularity Class"]

        print(row)
        formatted_data.append(row)

    with open('gdelt_nodes.csv', 'w') as f:
        f.write("id,label,page_rank,modula  rity_class\n")
        for data in formatted_data:
            f.write(data + "\n")


