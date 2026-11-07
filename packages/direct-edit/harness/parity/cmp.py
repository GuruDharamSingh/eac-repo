import json,sys,difflib
a=json.load(open(sys.argv[1]));b=json.load(open(sys.argv[2]))
print("keys",len(a),len(b),"only base",[k for k in a if k not in b][:8],"only now",[k for k in b if k not in a][:8])
d=[k for k in a if k in b and a[k]!=b[k]]
print("differ",len(d))
for k in d[:12]:
    x=json.dumps(a[k]);y=json.dumps(b[k])
    i=next((i for i,(p,q) in enumerate(zip(x,y)) if p!=q),min(len(x),len(y)))
    print("--",k,"at",i); print(" base:",x[max(0,i-120):i+200]); print(" now :",y[max(0,i-120):i+200])
print("sample keys",list(a)[:6],"...",list(a)[-6:])
print("errors",a.get("errors"),b.get("errors"))
