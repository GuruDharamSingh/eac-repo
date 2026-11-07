import json,sys
a=json.load(open(sys.argv[1]));b=json.load(open(sys.argv[2]))
print("steps",len(a),len(b))
d=[]
for x,y in zip(a,b):
    if x!=y:
        d.append(x[0] if isinstance(x,list) else "?")
print("differ",len(d),d[:10])
