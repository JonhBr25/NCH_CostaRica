/**
 * @NApiVersion 2.x
 * @NModuleScope Public 
 */

 define(["N/record", "N/runtime", "N/file", "N/email", "N/encode", "N/search", "N/format"], 
 	function(record, runtime, file, email, encode, search, format) {

	/*
	var URL_WS           = 'http://demo.comfiar.co.cr/ws/WSComfiar.asmx';
	var USER             = 'wsnchcr';
	var PASSWORD         = 'Iem800';
	*/

	var URL_WS      = '';
	var USER        = '';
	var PASSWORD    = '';
	var	URL_PD_WS   = '';
	var URL_CER_WS  = '';
	var HOST_WS     = '';
	var AMBIENTE_WS = '';
	var FORMATO_WS  = '';
	var RUTNCH_WS	= '';
	var SesionId    = '';
	var FechaVencimiento = '';
	var TransaccionId    = '';
	var internalId       = '';
	var tranID 			 = '';
	var Sender			 = '';
	var Semail			 = '';
	var subsi			 = '';
	var cuitId           = '';//RUT EMISOR
	var codDoc           = '';//TIPO DE DOCUMENTO
	var serDoc			 = '';//SERIE DE DOCUMENTO
	var numDoc			 = '';//NUMERO DE DOCUMENTO SIN SERIE
	var puntoDeVentaIdWS = '';//PUNTO DE VENTA SEGUN TRANSACTION 01=FACTURA
	var exito            = false;
	var exito2           = false;
	var estado_comfiar   = '';
	var date_comfiar	 = '';
	var estado_dgt		 = '';
	var error			 = '';
	var PDF              = '';		
	var nroCbte          = '';
	var secuencial 		 = '';
	var typedoc			 = 'F';
	var identifydoc		 = '';
	var mesagedoc		 = '';
	var debitnote		 = '';
	var statesend		 =  0;
	var idcomfiar		 =  '';
	var rec 			 = '';

	function send(plugInContext) {	

		var result = {
			success: true,
			message: "Success!"
		};
		try {

				rec = record.load({
				type: record.Type.CREDIT_MEMO,
				id: plugInContext.transaction.id});

			getEnableFeatures();//PARAMETROS INICIALES
			
			var returnIniSesion	= WSIniSesion();//INVOCA FUNCION INICIAL PARA OBTENER TOKEN			

			internalId = plugInContext.transaction.id;
			tranID     = plugInContext.transaction.number;
			Sender     = plugInContext.sender.id;
			Semail	   = plugInContext.sender.email;
			subsi      = rec.getValue('subsidiary');
			serDoc	   = '00'; 
			statesend  = rec.getValue('custbody_nch_code_state');
			idcomfiar  = rec.getValue('custbody_nch_tran_id');
			
			if(Sender == "" || Sender == null)
			{
				Sender = "-System-";
			}
			
			var xmlEnvio = plugInContext.eInvoiceContent;
			xmlEnvio = xmlEnvio.replace(/<br\s*[\/]?>/gi, " ");

			// OBTENEMOS TRANID Y ENVIAMOS A 8 POSICIONES				
			var notranid = xmlEnvio.split('-TRANID-')[1];
			var num_last = '-TRANID-' + notranid + '-TRANID-';
			var num_new  = tranID.substring(2, 9);
			var pad = "00000000";
			num_new = pad.substring(0, pad.length - num_new.length) + num_new;
			xmlEnvio = xmlEnvio.replace(num_last, num_new);

			//  OBTENEMOS RUT EMISOR
			cuitId = RUTNCH_WS;
			
	       // TIPO DE DOCUMENTO
			codDoc = '03';

			//LOGICA PARA OBTENER PUNTO DE VENTA
			puntoDeVentaIdWS = '100001';
			
			//CASES TO CR 171018
			switch(statesend)
			{
				case 0:
				var Rzero = ejecutaprocesozero(xmlEnvio);
				if(Rzero.Error) throw Rzero.Mensaje;
				break;

				case 1:
				var Runo = ejecutaprocesouno(xmlEnvio);
				if(Runo.Error) throw Runo.Mensaje;
				break;

				case 2:
				var Rdos = ejecutaprocesodos(xmlEnvio);
				if(Rdos.Error) throw Rdos.Mensaje;
				break;

				case 3:
				var Rtres = ejecutaprocesotres(xmlEnvio);
				if(Rtres.Error) throw Rtres.Mensaje;
				break;
			}		

		//sendMail(xmlEnvio, returnSalidaTransac, returnRespCbte, PDF, Sender, Semail);

		rec.save({
					enableSourcing: true,
					ignoreMandatoryFields: true
					});
		
	} catch (e) {
		result.success = false;
		result.message = e.valueOf().toString();
			//SAVE THE LOG IN NCH Log Lote de Envio EI 
			var logRecord = record.create({type: 'customrecord_nch_lote_envio_ei'});
			logRecord.setValue('custrecord_nch_envio_subsi', subsi);
			logRecord.setValue('custrecord_nch_envio_user', Sender);
			logRecord.setValue('custrecord_nch_envio_transac', internalId);
			logRecord.setValue('custrecord_nch_envio_estado', e.valueOf().toString().substring(0,300));
			logRecord.save();
			rec.save();
			//sendMail(xmlEnvio, returnSalidaTransac, returnRespCbte, PDF, Sender, Semail);
		}

		return result;		
	};

	function ejecutaprocesozero(xmlEnvio)
	{
		try{
			
			var objresp = {};
			
			//CONSULTA ULTIMO NUMERO EN COMFIAR Y ASIGNA CORRELATIVOS Y NROCBTE
			var returnUltimoNroCbte = WSUltimoNroCbte();
			
			var numeracion = xmlEnvio.split('-NUMERACION-')[1];
			var numeracion_last = '-NUMERACION-' + numeracion + '-NUMERACION-';
			var numeracion_new  = secuencial;
			xmlEnvio = xmlEnvio.replace(numeracion_last, numeracion_new);
			
			var numeracion2 = xmlEnvio.split('-NUMERACION2-')[1];
			var numeracion_last2 = '-NUMERACION2-' + numeracion2 + '-NUMERACION2-';
			var numeracion_new2  = secuencial;
			xmlEnvio = xmlEnvio.replace(numeracion_last2, numeracion_new2);
			
			numDoc = secuencial;
			
			var tranprefix = 'CR';

		 	var returnAutCbtsAsinc	= WSAutCbtsAsinc(xmlEnvio);//FUNCTION ASINCRONA

			// Tiempo de espera de respuesta de COMFIAR
			sleep(15000);// AQUI MAS

			var RspSalidaTran = '';
			if( !isNaN(parseInt(TransaccionId)) && parseInt(TransaccionId)>0)
			{
				RspSalidaTran = WSSalidaTransac();
			}
			
			//SI EL ESTADO DE COMFIAR ES ACEPTADO REALIZAMOS CONSULTA DE COMPROBANTE
			if (exito == true)
			{
				// Tiempo de espera de respuesta de DGT
				sleep(5000);
				var returnRespCbte = WSRespCbte();
				
			}else{                
				rec.setValue('custbody_state_comfiar_pe', estado_comfiar);
				rec.setValue('custbody_date_comfiar_pe', date_comfiar);
				rec.setValue('custbody_lmry_webserviceerror', 'Identificador Comfiar '+' '+identifydoc);
				rec.setValue('custbody_lmry_webserviceresponse', mesagedoc);
				sendMail(xmlEnvio, RspSalidaTran, null, null, Sender, Semail);
				throw "Failure";
            }			
			//SI EL ESTADO DE SUNAT ES AUTORIZADO GRABAMOS
			if (exito2 == true)
			{

	             var returnDescargarPdf = WSDescargarPdf();//CONSULTA PARA TRAER EL PDF EN BASE 64

	             rec.setValue('custbody_numero_doc', secuencial);
	             rec.setValue('tranid', tranprefix+' '+serDoc+puntoDeVentaIdWS+codDoc+numDoc);
	             rec.setValue('custbody_state_comfiar_pe', estado_comfiar);
	             rec.setValue('custbody_date_comfiar_pe', date_comfiar);
	             rec.setValue('custbody_state_sunat_pe', estado_dgt);
	             rec.setValue('custbody_lmry_webserviceerror',"Emision exitosa");
	             rec.setValue('custbody_lmry_webserviceresponse', returnRespCbte);
	             
	              //SAVE FILE IN NETSUITE
	              var fileObj = file.create({
	              	name: 'NC '+serDoc+puntoDeVentaIdWS+codDoc+numDoc+'.pdf',
	              	fileType: file.Type.PDF,
	              	contents: PDF
	              });
	              fileObj.folder = 2681223;
	              var id = fileObj.save();
	              fileObj = file.load({
	              	id: id
	              });

	            //SAVE FILE IN TRASACTION
	            var idtran = fileObj.id;
	            rec.setValue('custbody_pdf_cl', idtran);   

	          }else{                
	          	rec.setValue('custbody_numero_doc', secuencial);
	          	rec.setValue('tranid', tranprefix+' '+serDoc+puntoDeVentaIdWS+codDoc+numDoc);
	          	rec.setValue('custbody_state_comfiar_pe', estado_comfiar);
	          	rec.setValue('custbody_date_comfiar_pe', date_comfiar);
	          	rec.setValue('custbody_state_sunat_pe', estado_dgt);
	          	rec.setValue('custbody_lmry_webserviceerror', 'Identify DGT '+' '+identifydoc);
	          	rec.setValue('custbody_lmry_webserviceresponse', mesagedoc);
	          	sendMail(xmlEnvio, RspSalidaTran, returnRespCbte, null, Sender, Semail);
	          	throw "Failure";
         	 }

         	 objresp.Error = false;

         }catch(e){
         	objresp.Error = true;
         	objresp.Mensaje = String(e);		
         }
         return objresp;	 
	}

	function ejecutaprocesouno(xmlEnvio)
	{
		try{
			
			var objresp = {};
			
			numDoc = rec.getValue('custbody_numero_doc');
			
			var tranprefix = 'CR';

		 	TransaccionId = parseInt(idcomfiar);

			var RspSalidaTran = WSSalidaTransac();
						
			//SI EL ESTADO DE COMFIAR ES ACEPTADO REALIZAMOS CONSULTA DE COMPROBANTE
			if (exito == true)
			{
				// Tiempo de espera de respuesta de DGT
				sleep(5000);
				var returnRespCbte = WSRespCbte();
				
			}else{                
				rec.setValue('custbody_state_comfiar_pe', estado_comfiar);
				rec.setValue('custbody_date_comfiar_pe', date_comfiar);
				rec.setValue('custbody_lmry_webserviceerror', 'Identificador Comfiar '+' '+identifydoc);
				rec.setValue('custbody_lmry_webserviceresponse', mesagedoc);
				sendMail(xmlEnvio, RspSalidaTran, null, null, Sender, Semail);
				throw "Failure";
            }			
			//SI EL ESTADO DE SUNAT ES AUTORIZADO GRABAMOS
			if (exito2 == true)
			{

	             var returnDescargarPdf = WSDescargarPdf();//CONSULTA PARA TRAER EL PDF EN BASE 64

	             rec.setValue('custbody_numero_doc', numDoc);
	             rec.setValue('tranid', tranprefix+' '+serDoc+puntoDeVentaIdWS+codDoc+numDoc);
	             rec.setValue('custbody_state_comfiar_pe', estado_comfiar);
	             rec.setValue('custbody_date_comfiar_pe', date_comfiar);
	             rec.setValue('custbody_state_sunat_pe', estado_dgt);
	             rec.setValue('custbody_lmry_webserviceerror',"Emision exitosa");
	             rec.setValue('custbody_lmry_webserviceresponse', returnRespCbte);
	             
	              //SAVE FILE IN NETSUITE
	              var fileObj = file.create({
	              	name: 'NC '+serDoc+puntoDeVentaIdWS+codDoc+numDoc+'.pdf',
	              	fileType: file.Type.PDF,
	              	contents: PDF
	              });
	              fileObj.folder = 2681223;
	              var id = fileObj.save();
	              fileObj = file.load({
	              	id: id
	              });

	            //SAVE FILE IN TRASACTION
	            var idtran = fileObj.id;
	            rec.setValue('custbody_pdf_cl', idtran);   

	          }else{                
	          	rec.setValue('custbody_numero_doc', numDoc);
	          	rec.setValue('tranid', tranprefix+' '+serDoc+puntoDeVentaIdWS+codDoc+numDoc);
	          	rec.setValue('custbody_state_comfiar_pe', estado_comfiar);
	          	rec.setValue('custbody_date_comfiar_pe', date_comfiar);
	          	rec.setValue('custbody_state_sunat_pe', estado_dgt);
	          	rec.setValue('custbody_lmry_webserviceerror', 'Identify DGT '+' '+identifydoc);
	          	rec.setValue('custbody_lmry_webserviceresponse', mesagedoc);
	          	sendMail(xmlEnvio, RspSalidaTran, returnRespCbte, null, Sender, Semail);
	          	throw "Failure";
         	 }

         	 objresp.Error = false;

         }catch(e){
         	objresp.Error = true;
         	objresp.Mensaje = String(e);		
         }
         return objresp;	 
	}

	function ejecutaprocesodos(xmlEnvio)
	{
		try{
			
			var objresp = {};
			
			numDoc = rec.getValue('custbody_numero_doc');
			
			var tranprefix = 'CR';

		 	TransaccionId = parseInt(idcomfiar);

			var returnRespCbte = WSRespCbte();
				
			//SI EL ESTADO DE DGT ES AUTORIZADO
			if (exito2 == true)
			{

	             var returnDescargarPdf = WSDescargarPdf();//CONSULTA PARA TRAER EL PDF EN BASE 64

	             rec.setValue('custbody_numero_doc', numDoc);
	             rec.setValue('tranid', tranprefix+' '+serDoc+puntoDeVentaIdWS+codDoc+numDoc);
	             rec.setValue('custbody_state_sunat_pe', estado_dgt);
	             rec.setValue('custbody_lmry_webserviceerror',"Emision exitosa");
	             rec.setValue('custbody_lmry_webserviceresponse', returnRespCbte);
	             
	              //SAVE FILE IN NETSUITE
	              var fileObj = file.create({
	              	name: 'NC '+serDoc+puntoDeVentaIdWS+codDoc+numDoc+'.pdf',
	              	fileType: file.Type.PDF,
	              	contents: PDF
	              });
	              fileObj.folder = 2681223;
	              var id = fileObj.save();
	              fileObj = file.load({
	              	id: id
	              });

	            //SAVE FILE IN TRASACTION
	            var idtran = fileObj.id;
	            rec.setValue('custbody_pdf_cl', idtran);   

	          }else{                
	          	rec.setValue('custbody_numero_doc', numDoc);
	          	rec.setValue('tranid', tranprefix+' '+serDoc+puntoDeVentaIdWS+codDoc+numDoc);
	          	rec.setValue('custbody_state_sunat_pe', estado_dgt);
	          	rec.setValue('custbody_lmry_webserviceerror', 'Identify DGT '+' '+identifydoc);
	          	rec.setValue('custbody_lmry_webserviceresponse', mesagedoc);
	          	sendMail(xmlEnvio, returnSalidaTransac, returnRespCbte, Sender, Semail);
	          	throw "Failure";
         	 }

         	 objresp.Error = false;

         }catch(e){
         	objresp.Error = true;
         	objresp.Mensaje = String(e);		
         }
         return objresp;	 
	}

	function ejecutaprocesotres(xmlEnvio)
	{
		try{
			
			var objresp = {};
			
			numDoc = rec.getValue('custbody_numero_doc');
			
			var tranprefix = 'CR';

		 	TransaccionId = parseInt(idcomfiar);

			var returnDescargarPdf = WSDescargarPdf();//CONSULTA PARA TRAER EL PDF EN BASE 64

	        //SAVE FILE IN NETSUITE
	           var fileObj = file.create({
	        	  	name: 'NC '+serDoc+puntoDeVentaIdWS+codDoc+numDoc+'.pdf',
	           		fileType: file.Type.PDF,
	              	contents: PDF
	              	});
	              fileObj.folder = 2681223;
	            var id = fileObj.save();
	              fileObj = file.load({
	              	id: id
	              });

	            //SAVE FILE IN TRASACTION
	            var idtran = fileObj.id;
	            rec.setValue('custbody_pdf_cl', idtran);   

         	 objresp.Error = false;

         }catch(e){
         	objresp.Error = true;
         	objresp.Mensaje = String(e);		
         }
         return objresp;	 
	}

	function WSIniSesion(){

		var StringXML = 
		'<?xml version="1.0" encoding="utf-8"?>'+
		'<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'+
		'<soap:Body>'+
		'<IniciarSesion xmlns="http://comfiar.com.ar/webservice/">'+
		'	<usuarioId>'+USER+'</usuarioId>'+
		'	<password>'+PASSWORD+'</password>'+
		'</IniciarSesion>'+
		'</soap:Body>'+
		'</soap:Envelope>';	    

		var soapHeaders = new Array();
		soapHeaders['Host'] = HOST_WS;
		soapHeaders['Content-Type'] = 'text/xml; charset=utf-8'; 
		soapHeaders['Content-Length'] = 'length';
		soapHeaders['SOAPAction'] = "http://comfiar.com.ar/webservice/IniciarSesion";

		var objIniSesion = '';
		if (AMBIENTE_WS == '1') {
			require(['N/http'], function(http) {
				objIniSesion    =   
				http.post({
					url: URL_CER_WS,
					body: StringXML,
					headers: soapHeaders
				});
			});
		}else if(AMBIENTE_WS == '2'){
			require(['N/https'], function(https) {
				objIniSesion    =   
				https.post({
					url: URL_PD_WS,
					body: StringXML,
					headers: soapHeaders
				});
			});
		}  
		
		var returnIniSesion = objIniSesion.body;
		returnIniSesion = replaceXML(returnIniSesion);

		var sesion = returnIniSesion.split('SesionId')[1];
		if(sesion != null && sesion != ''){
			SesionId = sesion.substring(1, sesion.length-2);
			FechaVencimiento = returnIniSesion.split('FechaVencimiento')[1];
			FechaVencimiento = FechaVencimiento.substring(1, FechaVencimiento.length-2);			
		}
		
		return returnIniSesion;
	}

	function WSAutCbtsAsinc(xml){
		
		var StringXML = 
		'<?xml version="1.0" encoding="utf-8"?>'+
		'<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'+
		'<soap:Body>'+
		'<AutorizarComprobantesAsincronico xmlns="http://comfiar.com.ar/webservice/">'+
		'<XML><![CDATA['+xml+']]></XML>'+
		'<cuitAProcesar>'+cuitId+'</cuitAProcesar>'+
		'<puntoDeVentaId>'+puntoDeVentaIdWS+'</puntoDeVentaId>'+
		'<tipoDeComprobanteId>'+codDoc+'</tipoDeComprobanteId>'+
		'<formatoId>'+FORMATO_WS+'</formatoId>'+
		'<token>'+
		'<SesionId>'+SesionId+'</SesionId>'+
		'<FechaVencimiento>'+FechaVencimiento+'</FechaVencimiento>'+
		'</token>'+
		'</AutorizarComprobantesAsincronico>'+
		'</soap:Body>'+
		'</soap:Envelope>'; 

		var soapHeaders = new Array(); 
		soapHeaders['Host'] = HOST_WS;
		soapHeaders['Content-Type'] = 'text/xml; charset=utf-8'; 
		soapHeaders['Content-Length'] = 'length';
		soapHeaders['SOAPAction'] = "http://comfiar.com.ar/webservice/AutorizarComprobantesAsincronico";

		var objAutCbtsAsinc = '';
		if (AMBIENTE_WS == '1') {
			require(['N/http'], function(http) {
				objAutCbtsAsinc    =   
				http.post({
					url: URL_CER_WS,
					body: StringXML,
					headers: soapHeaders
				});
			});
		}else if(AMBIENTE_WS == '2'){
			require(['N/https'], function(https) {
				objAutCbtsAsinc    =   
				https.post({
					url: URL_PD_WS,
					body: StringXML,
					headers: soapHeaders
				});
			});
		}

		var returnAutCbtsAsinc = objAutCbtsAsinc.body;
		returnAutCbtsAsinc = replaceXML(returnAutCbtsAsinc);	    

	    //var AutCbtsAsincResult = returnAutCbtsAsinc.split('AutorizarComprobantesAsincronicoResult')[1];
	    var SalidaTransaccion = returnAutCbtsAsinc.split('SalidaTransaccion')[1];
	    if(SalidaTransaccion != null && SalidaTransaccion != ''){
	    	var TransacId = SalidaTransaccion.split('ID')[1];
	    	if(TransacId != null && TransacId != ''){
	    		TransaccionId = TransacId.substring(1, TransacId.length-2);

	    		rec.setValue('custbody_nch_state_send', 2);
	          	rec.setValue('custbody_nch_tran_id', TransaccionId);
	          	rec.setValue('custbody_numero_doc', numDoc);
	    	}
	    }
	    return returnAutCbtsAsinc;
	}

	function WSSalidaTransac(){

		var StringXML = 
		'<?xml version="1.0" encoding="utf-8"?>'+
		'<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'+
		'<soap:Body>'+
		'<SalidaTransaccion xmlns="http://comfiar.com.ar/webservice/">'+
		'<cuitId>'+cuitId+'</cuitId>'+
		'<transaccionId>'+TransaccionId+'</transaccionId>'+
		'<token>'+
		'<SesionId>'+SesionId+'</SesionId>'+
		'<FechaVencimiento>'+FechaVencimiento+'</FechaVencimiento>'+
		'</token>'+
		'</SalidaTransaccion>'+
		'</soap:Body>'+
		'</soap:Envelope>'; 

		var soapHeaders = new Array(); 
		soapHeaders['Host'] = HOST_WS;
		soapHeaders['Content-Type'] = 'text/xml; charset=utf-8'; 
		soapHeaders['Content-Length'] = 'length';
		soapHeaders['SOAPAction'] = "http://comfiar.com.ar/webservice/SalidaTransaccion";

		var objSalidaTransac = '';
		if (AMBIENTE_WS == '1') {
			require(['N/http'], function(http) {
				objSalidaTransac    =   
				http.post({
					url: URL_CER_WS,
					body: StringXML,
					headers: soapHeaders
				});
			});
		}else if(AMBIENTE_WS == '2'){
			require(['N/https'], function(https) {
				objSalidaTransac    =   
				https.post({
					url: URL_PD_WS,
					body: StringXML,
					headers: soapHeaders
				});
			});
		}

		var BodySalidaTransac	= objSalidaTransac.body;
		var returnSalidaTransac = replaceXML(BodySalidaTransac);


		var estado = returnSalidaTransac.split('Resultado>')[1];
		
		if(estado != null && estado != ''){	

			var dateCo = returnSalidaTransac.split('Fecha>')[1];

			estado = estado.substring(0, estado.length-2);
			dateCo = dateCo.substring(0, dateCo.length-2);
			
			if (estado == 'A' || estado == 'O') {
				exito = true;
				estado_comfiar = estado;
				date_comfiar = dateCo;

				rec.setValue('custbody_nch_state_send', 3);

			}else{

				rec.setValue('custbody_nch_state_send', 1);
				rec.setValue('custbody_nch_tran_id', null);
				rec.setValue('custbody_numero_doc', null);

				var idenfica = returnSalidaTransac.split('Id>')[1];
				var mensage = returnSalidaTransac.split('Descripcion>')[1];
				
				exito = false;
				estado_comfiar = estado;
				date_comfiar = dateCo;
				
				identifydoc = idenfica;
				mesagedoc = mensage;
			}
			
			//LOG DE SEGUIMIENTO COMFIAR
			var logRecord = record.create({type: 'customrecord_nch_lote_envio_ei'});
			logRecord.setValue('custrecord_nch_envio_subsi', subsi);
			logRecord.setValue('custrecord_nch_envio_user', runtime.getCurrentUser().id);
			logRecord.setValue('custrecord_nch_envio_transac', internalId);
			logRecord.setValue('custrecord_nch_envio_estado', "COMFIAR :"+" "+estado+" "+date_comfiar);
			logRecord.setValue('custrecord_nch_envio_descri', returnSalidaTransac);
			logRecord.setValue('custrecord_nch_envio_identy', TransaccionId+" "+ numDoc);
			logRecord.setValue('custrecord_nch_envio_tipdoc', codDoc);
			logRecord.setValue('custrecord_nch_sesion_id', SesionId);
			logRecord.setValue('custrecord_date_token', FechaVencimiento);
			logRecord.save();
		}

		return returnSalidaTransac;
	}

	function WSRespCbte(){

		var StringXML = 
		'<?xml version="1.0" encoding="utf-8"?>'+
		'<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'+
		'<soap:Body>'+
		'<RespuestaComprobante xmlns="http://comfiar.com.ar/webservice/">'+
		'<cuitId>'+cuitId+'</cuitId>'+
		'<puntoDeVentaId>'+puntoDeVentaIdWS+'</puntoDeVentaId>'+
		'<tipoDeComprobanteId>'+codDoc+'</tipoDeComprobanteId>'+
		'<nroCbte>'+numDoc+'</nroCbte>'+
		'<token>'+
		'<SesionId>'+SesionId+'</SesionId>'+
		'<FechaVencimiento>'+FechaVencimiento+'</FechaVencimiento>'+
		'</token>'+
		'</RespuestaComprobante>'+
		'</soap:Body>'+
		'</soap:Envelope>';	    

		var soapHeaders = new Array(); 
		soapHeaders['Host'] = HOST_WS;
		soapHeaders['Content-Type'] = 'text/xml; charset=utf-8'; 
		soapHeaders['Content-Length'] = 'length';
		soapHeaders['SOAPAction'] = "http://comfiar.com.ar/webservice/RespuestaComprobante";

		var objRespCbte = '';
		
		sleep(2000);

		if (AMBIENTE_WS == '1') {
			require(['N/http'], function(http) {
				objRespCbte    =   
				http.post({
					url: URL_CER_WS,
					body: StringXML,
					headers: soapHeaders
				});
			});
		}else if(AMBIENTE_WS == '2'){
			require(['N/https'], function(https) {
				objRespCbte    =   
				https.post({
					url: URL_PD_WS,
					body: StringXML,
					headers: soapHeaders
				});
			});
		}
		
		var returnRespCbte = objRespCbte.body;
		returnRespCbte = replaceXML(returnRespCbte);

		var estado2 = returnRespCbte.split('Resultado>')[1];
		var keydgt = returnRespCbte.split('Autorizacion>')[1];

		if(estado2 != null && estado2 != '')
		{				
			estado2 = estado2.substring(0, estado2.length-2);
			keydgt = keydgt.substring(0, keydgt.length-2);
		}

		if (estado2 == 'A' || estado2 == 'O') {
			exito2 = true;
			estado_dgt = keydgt;

			rec.setValue('custbody_nch_state_send', 4);
		}
		else{

			rec.setValue('custbody_nch_state_send', 1);
			rec.setValue('custbody_nch_tran_id', null);	
			rec.setValue('custbody_numero_doc', null);

			var idenficaS = returnRespCbte.split('Id>')[1];
			var mensageS = returnRespCbte.split('Descripcion>')[1];

			exito2 = false;
			estado_dgt = keydgt;

			identifydoc = idenficaS;
			mesagedoc = mensageS;			
		}

		//LOG SEGUIMIENTO SUNAT
		var logRecord = record.create({type: 'customrecord_nch_lote_envio_ei'});
		logRecord.setValue('custrecord_nch_envio_subsi', subsi);
		logRecord.setValue('custrecord_nch_envio_user', runtime.getCurrentUser().id);
		logRecord.setValue('custrecord_nch_envio_transac', internalId);
		logRecord.setValue('custrecord_nch_envio_estado', "DGT :"+ " "+estado_dgt);
		logRecord.setValue('custrecord_nch_envio_descri', returnRespCbte);
		logRecord.setValue('custrecord_nch_envio_identy', TransaccionId+" "+ numDoc);
		logRecord.setValue('custrecord_nch_envio_tipdoc', codDoc);
		logRecord.setValue('custrecord_nch_envio_folio', serDoc+" "+puntoDeVentaIdWS);
		logRecord.setValue('custrecord_nch_sesion_id', SesionId);
		logRecord.setValue('custrecord_date_token', FechaVencimiento);
		logRecord.save();

		return returnRespCbte;
	}

	function WSUltimoNroCbte(){

		var StringXML = 
		'<?xml version="1.0" encoding="utf-8"?>'+
		'<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'+
		'  <soap:Body>'+
		'    <UltimoNumeroComprobante xmlns="http://comfiar.com.ar/webservice/">'+
		'      <cuitId>'+cuitId+'</cuitId>'+
		'      <puntoDeVentaId>'+puntoDeVentaIdWS+'</puntoDeVentaId>'+
		'      <tipoDeComprobanteId>'+codDoc+'</tipoDeComprobanteId>'+
		'      <token>'+
		'        <SesionId>'+SesionId+'</SesionId>'+
		'        <FechaVencimiento>'+FechaVencimiento+'</FechaVencimiento>'+
		'      </token>'+
		'    </UltimoNumeroComprobante>'+
		'  </soap:Body>'+
		'</soap:Envelope>';

		var soapHeaders = new Array(); 
		soapHeaders['Host'] = HOST_WS;
		soapHeaders['Content-Type'] = 'text/xml; charset=utf-8'; 
		soapHeaders['Content-Length'] = 'length';
		soapHeaders['SOAPAction'] = "http://comfiar.com.ar/webservice/UltimoNumeroComprobante";
		
		var returnUltimoNroCbte = '';
		if (AMBIENTE_WS == '1') {
			require(['N/http'], function(http) {
				returnUltimoNroCbte    =   
				http.post({
					url: URL_CER_WS,
					body: StringXML,
					headers: soapHeaders
				});
			});
		}else if(AMBIENTE_WS == '2'){
			require(['N/https'], function(https) {
				returnUltimoNroCbte    =   
				https.post({
					url: URL_PD_WS,
					body: StringXML,
					headers: soapHeaders
				});
			});
		}

		var UltimoNroCbteResult = returnUltimoNroCbte.body.split('UltimoNumeroComprobanteResult')[1];
		if(UltimoNroCbteResult != null && UltimoNroCbteResult != ''){	

			secuencial = UltimoNroCbteResult.substring(1, UltimoNroCbteResult.length-2);
			secuencial = parseInt(secuencial) + 1;

			secuencial = "" + secuencial;
			var pad = "0000000000";
			secuencial = pad.substring(0, pad.length - secuencial.length) + secuencial;
			nroCbte = secuencial;
		}

		return returnUltimoNroCbte.body;
	}

	function WSDescargarPdf(){

		var StringXML = 
		'<?xml version="1.0" encoding="utf-8"?>'+
		'<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'+
		'  <soap:Body>'+
		'    <DescargarPdf xmlns="http://comfiar.com.ar/webservice/">'+
		'      <transaccionId>'+TransaccionId+'</transaccionId>'+
		'      <cuitId>'+cuitId+'</cuitId>'+
		'      <puntoDeVentaId>'+puntoDeVentaIdWS+'</puntoDeVentaId>'+
		'      <tipoComprobanteId>'+codDoc+'</tipoComprobanteId>'+
		'      <numeroComprobante>'+numDoc+'</numeroComprobante>'+
		'      <token>'+
		'        <SesionId>'+SesionId+'</SesionId>'+
		'        <FechaVencimiento>'+FechaVencimiento+'</FechaVencimiento>'+
		'      </token>'+
		'    </DescargarPdf>'+
		'  </soap:Body>'+
		'</soap:Envelope>';

		var soapHeaders = new Array(); 
		soapHeaders['Host'] = HOST_WS;
		soapHeaders['Content-Type'] = 'text/xml; charset=utf-8'; 
		soapHeaders['Content-Length'] = 'length';
		soapHeaders['SOAPAction'] = "http://comfiar.com.ar/webservice/DescargarPdf";

		var returnDescargarPdf = '';
		if (AMBIENTE_WS == '1') {
			require(['N/http'], function(http) {
				returnDescargarPdf    =   
				http.post({
					url: URL_CER_WS,
					body: StringXML,
					headers: soapHeaders
				});
			});
		}else if(AMBIENTE_WS == '2'){
			require(['N/https'], function(https) {
				returnDescargarPdf    =   
				https.post({
					url: URL_PD_WS,
					body: StringXML,
					headers: soapHeaders
				});
			});
		}

		var DescargarPdfResult = returnDescargarPdf.body.split('DescargarPdfResult')[1];
		if(DescargarPdfResult != null && DescargarPdfResult != ''){
			PDF = DescargarPdfResult.substring(1, DescargarPdfResult.length-2);

			rec.setValue('custbody_nch_state_send', 5);
		}

		return returnDescargarPdf.body;
	}

	function sendMail(content, WSSalidaTransac, WSRespCbte, PDF, userlog, maillog){

		var currentuser = runtime.getCurrentUser().id;
		var emailUser   = runtime.getCurrentUser().email;
		//var currentuser = userlog;
		//var emailUser   = maillog;
		var today = new Date();

		var recEmp = search.lookupFields({
			type: search.Type.EMPLOYEE,
			id: currentuser,
			columns: 'firstname'
		});
		var nameUser    = recEmp.firstname;

		var body =  '<table style="border:lightgrey 15px solid;" width="750">';
		body += '<td style="padding-left:13pt; padding-right:13pt; padding-bottom:13pt; color:#585858; font-size:15px;">';
		body += '<img src="https://checkout.na1.netsuite.com/core/media/media.nl?id=1636345&c=3574893&h=3c7604ee19ca18e025fd" width="125" height="125" />';
		body += '<hr>';
		body += '<p><span style="color:#01A9DB; font-size:16px;"><b>Estimad(@) :</b></span></p>';
		body += '<hr>';
		body += '<p style="padding-bottom:12px;">Mensaje Automatico desde NetSuite Electronic Invoicing App. </p>';
		if (exito) {
			body += '<p>Se ha generado el Documento Electronico <b>' + typedoc+'-'+secuencial + '</b> con Internal ID <b>' + internalId + '</b>.</p>';
		}else{
			body += '<p>Mensaje de error automático de NCH SuiteApp.</p>';
			body += '<p>Se produjo un error al emitir el Documento Electronico <b>' + typedoc+'-'+secuencial + '</b> con Internal ID <b>' + internalId + '</b>.</p>';
			body += '<p>Por favor, comunícate con nuestro departamento de Desarrollo a: jonathan.jimenez@nch.com</p>';
			body += '<p>Nosotros nos encargamos.</p>';
		}
		body += '<br>';
		body += '<p>Saludos Cordiales,</p>';
		body += 'El equipo de NCH CORPORATION';
		body += '<br>';
		body += '<a style="font-size:13px" href="http://www.nch.com/">www.nch.com</a>';
		body += '<br><br>';
		body += '<p><strong>*** NO RESPONDA A ESTE MENSAJE ***</strong></p>';
		body += '<br>';
		body += '<hr>'; 
		body += '<br><br>';
		body += '<img src="https://system.na1.netsuite.com/core/media/media.nl?id=552&c=TSTDRV1038915&h=d2823d71514640fd9a37" align="right"/>';
		body += '</td>';
		body += '</table>';	
		body += '</body>';
		
		var fileXML = new Array();
		//var FileName = 'Archivo Facturacion Electronica ' + today +'.CSV';

		var i = 0;
		var FileName = 'XML Request NCH CR.ftl';

		if(content != null && content != ''){
			fileXML[0] = file.create({
				name    : FileName,
				fileType: file.Type.FREEMARKER,
				contents: content
			});
			i++;
		}
		if(WSSalidaTransac != null && WSSalidaTransac != ''){
			fileXML[i] = file.create({
				name    : "Response Transaccion COMFIAR.xml",
				fileType: file.Type.XMLDOC,
				contents: WSSalidaTransac
			});
			i++;
		}
		if(WSRespCbte != null && WSRespCbte != ''){
			fileXML[i] = file.create({
				name    : "Response Transaccion DGT.xml",
				fileType: file.Type.XMLDOC,
				contents: WSRespCbte
			});
			i++;
		}
		if(PDF != null && PDF != ''){
			fileXML[i] = file.create({
				name    : "Response PDF.pdf",
				fileType: file.Type.PDF,
				contents: PDF
			});
			i++;
		}				
		//fileXML[0].save();
		var subject = '';
        if (codDoc == '03') {
            subject = "NCH - Nota de Credito Electrónica CR: NC " +secuencial;
        }

		email.send({
			author: currentuser,
            //recipients: emailUser,
            recipients: ['jonathan.jimenez@nch.com'],
            cc: ['plara@nch.com'],
            subject: subject,
            body: body,
            attachments: fileXML
        });
	}	

	function replaceXML(xml){
		xml = xml.replace(/&lt;/g, '<');
		xml = xml.replace(/&gt;/g, '>');
		xml = xml.replace(/&amp;lt;/g, '<');
		xml = xml.replace(/&amp;gt;/g, '>');

		return xml;
	}

	function retornaValorFecha(valor){
		valor = valor+'';
		if(valor.substr(1,1)=='-'){
			valor = '0'+valor;
		}
		if(valor.substr(4,1)=='-'){
			valor = valor.split('-')[0]+'-'+valor.split('-')[1]+'-'+valor.split('-')[2];
		}
		//valor = fechaDiaMesAnio(valor);
		return valor;
	}

	function getEnableFeatures(){

    // Registro Personalizado NCH Enable Feature Acces CL 


    var HostSandbox = 'demo.comfiar.co.cr';
    var HostProduct = 'app.comfiar.co.cr';

    busqEnabFet = search.create({
    	type: 'customrecord_nch_cl_enable_acces',
    	columns: ['custrecord_cl_fel_usuario_ws', 'custrecord_cl_fel_password_ws', 'custrecord_cl_fel_url_acceso_ws',
    	'custrecord_cl_url_cargaemite_ws', 'custrecord_cl_ambiente_ws', 'custrecord_cl_fel_host_ws', 
    	'custrecord_cl_formatoid_ws','custrecord_cl_fel_usuariocliente_ws']});
    resultEnabFet = busqEnabFet.run().getRange(0, 10);
    
    		if(resultEnabFet != null && resultEnabFet.length > 0){
                row  = resultEnabFet[0].columns;
                for (var i = 0; i < resultEnabFet.length; i++) {
                    if( resultEnabFet[i].getValue(row[5]) == HostProduct )
                    {
                        USER		= resultEnabFet[i].getValue(row[0]);
                        PASSWORD    = resultEnabFet[i].getValue(row[1]);
                        URL_PD_WS   = resultEnabFet[i].getValue(row[2]);
                        URL_CER_WS  = resultEnabFet[i].getValue(row[3]);
                        AMBIENTE_WS = resultEnabFet[i].getValue(row[4]);
                        HOST_WS     = resultEnabFet[i].getValue(row[5]);
                        FORMATO_WS  = resultEnabFet[i].getValue(row[6]);
                        RUTNCH_WS	= resultEnabFet[i].getValue(row[7]);
                        break;
                    }
                }
            }
}

function sleep(milliseconds) {
	var start = new Date().getTime();
	for (var i = 0; i < 1e7; i++) {
		if ((new Date().getTime() - start) > milliseconds){
			break;
		}
	}
}

return{
	send: send
};
});