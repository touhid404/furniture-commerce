import json
from pathlib import Path
ref=lambda n:{'$ref':f'#/components/schemas/{n}'}
def obj(props,required=None,extra=False):return {'type':'object','properties':props,'required':list(props) if required is None else required,'additionalProperties':extra}
s={'type':'string'};uuid={'type':'string','format':'uuid'};timestamp={'type':'string','format':'date-time'};pos={'type':'integer','minimum':1,'maximum':999}
def arr(v):return {'type':'array','items':v}
def envelope(v):return obj({'data':v})
S={
 'Money':obj({'amountMinor':{'type':'string','pattern':'^[0-9]+$'},'currency':{'type':'string','pattern':'^[A-Z]{3}$'}}),
 'Error':obj({'error':obj({'code':s,'message':s,'fields':{'type':'object','additionalProperties':s}},['code','message']),'requestId':s}),
 'Address':obj({'recipient':s,'line1':s,'line2':s,'city':s,'region':s,'postalCode':s,'country':{'type':'string','pattern':'^[A-Z]{2}$'},'phone':s},['recipient','line1','city','country']),
 'Variant':obj({'id':uuid,'sku':s,'options':{'type':'object','additionalProperties':s},'price':ref('Money'),'available':{'type':'boolean'}}),
 'Product':obj({'id':uuid,'slug':s,'name':s,'description':s,'categoryId':uuid,'imageUrl':{'type':'string','format':'uri-reference'},'variants':arr(ref('Variant'))}),
 'CartItem':obj({'id':uuid,'variantId':uuid,'name':s,'quantity':pos,'unitPrice':ref('Money'),'lineTotal':ref('Money')}),
 'Cart':obj({'id':uuid,'marketId':s,'currency':s,'version':{'type':'integer','minimum':1},'items':arr(ref('CartItem')),'subtotal':ref('Money'),'warnings':arr(s)}),
 'Totals':obj({'subtotal':ref('Money'),'discount':ref('Money'),'shipping':ref('Money'),'tax':ref('Money'),'taxIncluded':{'type':'boolean'},'grandTotal':ref('Money')}),
 'Quote':obj({'id':uuid,'cartId':uuid,'expiresAt':timestamp,'configRevision':s,'totals':ref('Totals'),'availablePaymentMethods':arr({'type':'string','enum':['CARD','COD']})}),
 'OrderSubmission':obj({'orderId':uuid,'orderNumber':s,'paymentStatus':{'type':'string','enum':['UNPAID','PENDING','PAID']},'nextAction':obj({'type':{'const':'REDIRECT'},'url':{'type':'string','format':'uri'},'expiresAt':timestamp})},['orderId','orderNumber','paymentStatus']),
 'Readiness':obj({'status':{'const':'ready'},'database':obj({'status':{'const':'connected'},'checkedAt':timestamp,'latencyMs':{'type':'integer','minimum':0}})})
}
profile_schema=json.loads(Path('docs/config/store.schema.json').read_text())['properties']
public_keys=['storeId','revision','brand','timezone','defaultLocale','locales','defaultMarketId','currencies','markets','theme','navigation','home','messages']
S['PublicConfig']=obj({k:profile_schema[k] for k in public_keys}|{'capabilities':obj({'commerceReady':{'type':'boolean'},'cardConfigured':{'type':'boolean'},'shippingConfigured':{'type':'boolean'}})})
resp=lambda desc,sch:{'description':desc,'content':{'application/json':{'schema':sch}}}
params=lambda name,where='query',required=False,schema=s:{'name':name,'in':where,'required':required,'schema':schema}
paths={}
def operation(path,method,summary,success_schema,body=None,session=False,csrf=False,parameters=None,status='200',description='Planned commerce contract; implemented capability is recorded in the setup report.'):
 op={'summary':summary,'description':description,'operationId':method+'_'+path.strip('/').replace('/','_').replace('{','').replace('}',''),'security':[{'SessionCookie':[]}] if session else [],'responses':{status:resp('Success',success_schema),'default':resp('Structured error',ref('Error'))}}
 op['parameters']=parameters or []
 if csrf:op['parameters'].append(params('X-CSRF-Token','header',True,{'type':'string','minLength':16}))
 if body:op['requestBody']={'required':True,'content':{'application/json':{'schema':body}}}
 if not op['parameters']:del op['parameters']
 paths.setdefault(path,{})[method]=op
operation('/config','get','Read allowlisted store configuration',envelope(ref('PublicConfig')),description='Implemented by the foundation. Never returns backend credentials or private operational configuration.')
operation('/health/ready','get','Check API database readiness',envelope(ref('Readiness')),description='Implemented by the foundation. Executes a read-only PostgreSQL query via Prisma. Failure returns 503; response contains no credentials.')
operation('/auth/csrf','get','Create anonymous session and CSRF token',envelope(obj({'csrfToken':s})))
operation('/products','get','List published products',obj({'data':arr(ref('Product')),'meta':obj({'nextCursor':{'type':['string','null']}})}),parameters=[params('marketId',required=True),params('currency',required=True),params('category'),params('q'),params('cursor'),params('limit',schema={'type':'integer','minimum':1,'maximum':48}),params('sort',schema={'type':'string','enum':['featured','price-asc','price-desc','newest']})])
operation('/products/{slug}','get','Read published product details',envelope(ref('Product')),parameters=[params('slug','path',True),params('marketId',required=True),params('currency',required=True)])
operation('/cart','get','Read current session bag',envelope(ref('Cart')),session=True)
operation('/cart/items','post','Add a SKU to the bag',envelope(ref('Cart')),obj({'variantId':uuid,'quantity':pos}),session=True,csrf=True)
operation('/cart/items/{id}','patch','Set bag item quantity',envelope(ref('Cart')),obj({'quantity':pos}),session=True,csrf=True,parameters=[params('id','path',True,uuid)])
operation('/cart/items/{id}','delete','Remove bag item',envelope(ref('Cart')),session=True,csrf=True,parameters=[params('id','path',True,uuid)])
operation('/checkout/quotes','post','Validate checkout and quote current bag',envelope(ref('Quote')),obj({'marketId':s,'currency':s,'shippingAddress':ref('Address'),'shippingMethodId':s,'contactEmail':{'type':'string','format':'email'},'couponCode':s},['marketId','currency','shippingAddress','shippingMethodId','contactEmail']),session=True,csrf=True,status='201')
operation('/checkout/orders','post','Submit a quote and begin payment',envelope(ref('OrderSubmission')),obj({'quoteId':uuid,'paymentMethod':{'type':'string','enum':['CARD','COD']}}),session=True,csrf=True,status='201',parameters=[params('Idempotency-Key','header',True,{'type':'string','minLength':16,'maxLength':128})],description='Planned. Transaction rechecks quote and stock, snapshots order and writes outbox. Retry same scoped key and request fingerprint returns the original result; changed fingerprint returns 409. Card return URLs cannot confirm payment.')
doc={'openapi':'3.1.0','info':{'title':'Furniture Commerce critical flow contract','version':'0.1.0','description':'Design contract for the critical shopping flow, not a complete implementation. Only config and readiness operations are implemented in the current foundation. Full route inventory is in docs/06-api-specification.md.'},'servers':[{'url':'/api/v1'}],'paths':paths,'components':{'securitySchemes':{'SessionCookie':{'type':'apiKey','in':'cookie','name':'__Host-shop_session','description':'Opaque anonymous or account session. Not implemented in the connectivity foundation.'}},'schemas':S}}
Path('docs/contracts/openapi.json').write_text(json.dumps(doc,indent=2)+'\n')
