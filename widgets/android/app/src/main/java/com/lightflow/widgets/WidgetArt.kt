package com.lightflow.widgets

import android.graphics.*
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.*

/** The only RemoteViews child is an ImageView: all detail is safely drawn off-screen. */
internal object WidgetArt {
    enum class Kind { BULB, CAROUSEL, DIAL }
    private val bg=Color.rgb(17,28,43)
    private val edge=Color.rgb(53,75,92)
    private val text=Color.rgb(244,248,254)
    private val muted=Color.rgb(159,179,195)
    private val green=Color.rgb(86,223,171)
    private val red=Color.rgb(249,126,131)
    private val gray=Color.rgb(137,152,170)
    private val font=Typeface.create("sans-serif",Typeface.NORMAL)
    private val medium=Typeface.create("sans-serif-medium",Typeface.NORMAL)
    private val bold=Typeface.create("sans-serif",Typeface.BOLD)

    private fun paint(color:Int,stroke:Float=1f,style:Paint.Style=Paint.Style.FILL)=
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color=color; strokeWidth=stroke; this.style=style
            strokeCap=Paint.Cap.ROUND; strokeJoin=Paint.Join.ROUND
        }
    private fun write(c:Canvas,s:String,x:Float,y:Float,size:Float,col:Int=text,
                      type:Typeface=font) {
        c.drawText(s,x,y,paint(col).apply {textSize=size;textAlign=Paint.Align.CENTER;typeface=type})
    }
    private fun polarX(cx:Float,r:Float,a:Double)=cx+cos(a).toFloat()*r
    private fun polarY(cy:Float,r:Float,a:Double)=cy+sin(a).toFloat()*r
    private fun nowPeriod(data:Schedule?,now:ZonedDateTime):Period? {
        val current=now.hour*60+now.minute+now.second/60f
        return data?.periods?.firstOrNull {
            val from=minutes(it.start) ?: 0
            val to=minutes(it.end) ?: 1440
            current>=from && current<to
        }
    }
    private fun base(c:Canvas,w:Float,h:Float) {
        val r=min(w,h)*.115f
        c.drawRoundRect(1f,1f,w-1f,h-1f,r,r,paint(bg))
        c.drawRoundRect(2f,2f,w-2f,h-2f,r,r,paint(edge,2.1f,Paint.Style.STROKE))
    }
    private fun bulb(c:Canvas,w:Float,h:Float,data:Schedule?,now:ZonedDateTime) {
        val state=nowPeriod(data,now)
        val accent=if(state==null) gray else if(state.off) red else green
        val side=min(w,h); val x=w*.5f; val y=h*.40f; val r=side*.205f
        val outline=Path().apply {
            moveTo(x-r*.73f,y+r*.65f)
            cubicTo(x-r*1.85f,y-r*.25f,x-r*.94f,y-r*1.88f,x,y-r*1.82f)
            cubicTo(x+r*.94f,y-r*1.88f,x+r*1.85f,y-r*.25f,x+r*.73f,y+r*.65f)
            cubicTo(x+r*.42f,y+r*.97f,x+r*.28f,y+r*1.1f,x+r*.28f,y+r*1.24f)
            lineTo(x-r*.28f,y+r*1.24f)
            cubicTo(x-r*.28f,y+r*1.1f,x-r*.42f,y+r*.97f,x-r*.73f,y+r*.65f)
            close()
        }
        c.drawPath(outline,paint(accent,side*.016f,Paint.Style.STROKE).apply {
            setShadowLayer(side*.055f,0f,0f,accent)
        })
        val lightning=Path().apply {
            moveTo(x+r*.1f,y-r*.83f)
            lineTo(x-r*.34f,y+r*.06f)
            lineTo(x-r*.05f,y+r*.06f)
            lineTo(x-r*.16f,y+r*.64f)
            lineTo(x+r*.40f,y-r*.26f)
            lineTo(x+r*.07f,y-r*.26f)
            close()
        }
        c.drawPath(lightning,paint(accent))
        for(i in 0..2)c.drawLine(x-r*.32f,y+r*(1.42f+i*.20f),
                              x+r*.32f,y+r*(1.42f+i*.20f),
                              paint(accent,side*.014f))
        // Deliberately nothing else: bulb, and a time interval below it.
        write(c, if(state==null) "--:--–--:--" else state.start+"–"+state.end,
              x,h*.89f,side*.090f,text,medium)
    }
    private fun strip(c:Canvas,w:Float,h:Float,data:Schedule?,now:ZonedDateTime) {
        val current=nowPeriod(data,now)
        val periods=data?.periods.orEmpty()
        val i=periods.indexOf(current)
        val top=h*.105f;val bottom=h*.79f
        val center=w*.5f
        val segmentWidth=w*.66f  // 66% of the visible carousel.
        val gap=w*.018f
        c.save();c.clipRect(w*.024f,top,w*.976f,bottom)
        if(i<0) {
            c.drawRoundRect(w*.16f,top,w*.84f,bottom,21f,21f,paint(edge))
            write(c,"Немає графіка",center,h*.53f,h*.18f,text,medium)
        } else {
            val start=minutes(current!!.start) ?: 0
            val end=minutes(current.end) ?: 1440
            val time=now.hour*60f+now.minute+now.second/60f
            val progress=((time-start)/(end-start).coerceAtLeast(1)).coerceIn(0f,1f)
            val left=center-progress*segmentWidth
            for(index in periods.indices) {
                if(index<i-3||index>i+3)continue
                val p=periods[index]
                val x=left+(index-i)*(segmentWidth+gap)
                if(x>w||x+segmentWidth<0f)continue
                val color=if(p.off)Color.rgb(99,45,58) else Color.rgb(29,91,76)
                val accent=if(p.off)red else green
                val radius=h*.12f
                c.drawRoundRect(x,top,x+segmentWidth,bottom,radius,radius,paint(color))
                c.drawRoundRect(x+2,top+2,x+segmentWidth-2,bottom-2,radius,radius,
                    paint(if(index==i)accent else edge,if(index==i)4f else 1.5f,
                          Paint.Style.STROKE))
                write(c,p.start+"–"+p.end,x+segmentWidth*.5f,
                    top+(bottom-top)*.46f,h*.19f,text,bold)
                write(c,if(p.off)"ВІДКЛЮЧЕННЯ" else "Є СВІТЛО ЗА ГРАФІКОМ",
                    x+segmentWidth*.5f,top+(bottom-top)*.76f,h*.105f,accent,medium)
            }
        }
        c.restore()
        val arrow=Path().apply {
            moveTo(center,h*.82f)
            lineTo(center-h*.042f,h*.89f)
            lineTo(center+h*.042f,h*.89f)
            close()
        }
        c.drawPath(arrow,paint(green)) // Fixed centre arrow. Only the graph moves.
    }
    private fun dial(c:Canvas,w:Float,h:Float,data:Schedule?,now:ZonedDateTime) {
        val side=min(w,h)
        val cx=w*.5f;val cy=h*.51f
        val radius=side*.350f;val thickness=side*.115f
        val bounds=RectF(cx-radius,cy-radius,cx+radius,cy+radius)
        c.drawCircle(cx,cy,radius,paint(edge,thickness,Paint.Style.STROKE))
        if(data!=null)for(period in data.periods) {
            val a=minutes(period.start) ?: continue
            val b=minutes(period.end) ?: continue
            val color=if(period.off)Color.rgb(105,49,60) else Color.rgb(29,96,75)
            c.drawArc(bounds,-90f+a/4f,(b-a)/4f,false,
                paint(color,thickness,Paint.Style.STROKE).apply {
                    strokeCap=Paint.Cap.BUTT
                })
        }
        for(hour in 0..23) {
            val angle=Math.toRadians((-90+hour*15).toDouble())
            c.drawLine(polarX(cx,radius-thickness*.54f,angle),
                polarY(cy,radius-thickness*.54f,angle),
                polarX(cx,radius+thickness*.54f,angle),
                polarY(cy,radius+thickness*.54f,angle),
                paint(bg,side*.003f))
            write(c,hour.toString(),polarX(cx,radius+thickness*.74f,angle),
                polarY(cy,radius+thickness*.74f,angle)+side*.012f,
                side*.035f,text,medium)
        }
        val current=nowPeriod(data,now)
        val accent=when(current?.off){true->red;false->green;null->gray}
        val elapsed=now.hour*3600+now.minute*60+now.second
        val angle=Math.toRadians(-90+elapsed/86400.0*360.0)
        val arrowRadius=radius+thickness*.51f
        val px=polarX(cx,arrowRadius,angle);val py=polarY(cy,arrowRadius,angle)
        c.drawLine(polarX(cx,side*.19f,angle),polarY(cy,side*.19f,angle),px,py,
            paint(text,side*.006f))
        val ux=cos(angle).toFloat(); val uy=sin(angle).toFloat()
        val tip=Path().apply {
            moveTo(px+ux*side*.021f,py+uy*side*.021f)
            lineTo(px-ux*side*.020f-uy*side*.012f,
                   py-uy*side*.020f+ux*side*.012f)
            lineTo(px-ux*side*.020f+uy*side*.012f,
                   py-uy*side*.020f-ux*side*.012f)
            close()
        }
        c.drawPath(tip,paint(text))
        c.drawCircle(cx,cy,side*.009f,paint(text))
        write(c,now.format(DateTimeFormatter.ofPattern("d MMMM",Locale("uk"))),
            cx,cy-side*.15f,side*.047f,muted,medium)
        write(c,"1.1",cx,cy-side*.012f,side*.130f,text,bold)
        write(c,"ПІДЧЕРГА",cx,cy+side*.040f,side*.031f,muted,medium)
        c.drawLine(cx-side*.135f,cy+side*.080f,
            cx+side*.135f,cy+side*.080f,paint(edge,side*.0025f))
        write(c,when(current?.off){
            true->"Відключення"
            false->"Світло за графіком"
            null->"Немає даних"
        },cx,cy+side*.15f,side*.045f,accent,medium)
    }

    fun draw(kind:Kind,schedule:Schedule?,now:ZonedDateTime):Bitmap {
        // Bounded ARGB_8888 images stay well below the widget binder bitmap quota.
        val size=when(kind){
            Kind.BULB->340 to 340
            Kind.CAROUSEL->840 to 260
            Kind.DIAL->630 to 630
        }
        val cBitmap=Bitmap.createBitmap(size.first,size.second,Bitmap.Config.ARGB_8888)
        val canvas=Canvas(cBitmap)
        base(canvas,size.first.toFloat(),size.second.toFloat())
        when(kind){
            Kind.BULB->bulb(canvas,size.first.toFloat(),size.second.toFloat(),schedule,now)
            Kind.CAROUSEL->strip(canvas,size.first.toFloat(),size.second.toFloat(),schedule,now)
            Kind.DIAL->dial(canvas,size.first.toFloat(),size.second.toFloat(),schedule,now)
        }
        return cBitmap
    }
}
